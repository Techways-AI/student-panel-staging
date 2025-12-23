from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from app.db.session import get_db
from app.models.content_library import ContentLibrary
from app.models.topic_mapping import TopicMapping
from app.api.auth import get_current_user
from app.models.user import User
import re
import os
import boto3
import json

router = APIRouter(prefix="/student", tags=["Student Content"])

# Initialize S3 client
s3_client = boto3.client(
    's3',
    aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
    aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
    region_name=os.getenv('AWS_REGION', 'ap-south-1')
)
BUCKET = os.getenv('S3_BUCKET')

def slugify(text: str) -> str:
    """
    Convert topic name to slug
    Example: 'Benzene and Its Derivatives' -> 'benzene-and-its-derivatives'
    """
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    return re.sub(r"[\s]+", "-", text)


@router.get("/topic-content")
def get_topic_content(
    topic: str = Query(..., description="Topic name from UI"),
    file_type: str = Query("video", regex="^(video|notes|document)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get content for a topic.
    1. If user university is not PCI, translate to PCI topic using topic_mappings.
    2. Query content_library using PCI topic_name or topic_slug.
    """
    print(f"🔍 DEBUG: get_topic_content called for topic='{topic}', university='{current_user.university}'")

    # 1️⃣ RESOLUTION LAYER: Handle PCI vs Non-PCI university
    pci_topic = topic
    pci_slug = slugify(topic)
    university = current_user.university or "PCI"

    if university != "PCI":
        print(f"🔄 Mapping topic '{topic}' for university '{university}'")
        mapping = (
            db.query(TopicMapping)
            .filter(
                TopicMapping.university_name == university,
                func.lower(TopicMapping.university_topic) == topic.lower().strip()
            )
            .first()
        )
        
        if mapping:
            pci_topic = mapping.pci_topic
            pci_slug = mapping.topic_slug
            print(f"✅ Found mapping: '{topic}' -> '{pci_topic}' (slug: {pci_slug})")
        else:
            print(f"⚠️ No mapping found for '{topic}' in {university}. Trying direct lookup as fallback.")

    # 2️⃣ CONTENT FETCHING LAYER: Always use PCI identifiers
    file_types = [file_type]
    if file_type == 'notes':
        file_types.append('document')
    elif file_type == 'document':
        # When querying for document, only get documents (not notes)
        file_types = ['document']
    
    content = (
        db.query(ContentLibrary)
        .filter(
            ContentLibrary.file_type.in_(file_types),
            or_(
                func.lower(ContentLibrary.topic_name) == pci_topic.lower().strip(),
                ContentLibrary.topic_slug == pci_slug,
                ContentLibrary.topic_slug.ilike(f"%{pci_slug}%") 
            )
        )
        .order_by(ContentLibrary.created_at.desc())
        .all()
    )

    if not content:
        print(f"❌ DEBUG: No content found in content_library for '{pci_topic}' (originally '{topic}')")
        return {
            "topic": topic,
            "pci_topic": pci_topic if university != "PCI" else None,
            "file_type": file_type,
            "items": []
        }

    print(f"✅ DEBUG: Found {len(content)} items in database")
    items = []
    for item in content:
        video_url = None
        notes_content = None
        s3_key = item.s3_key
        
        print(f"🔍 DEBUG: Processing item with s3_key='{s3_key}'")
        
        # If it's a video and points to metadata.json, read it to get the actual URL
        if file_type == 'video' and s3_key.endswith('metadata.json'):
            try:
                response = s3_client.get_object(Bucket=BUCKET, Key=s3_key)
                metadata = json.loads(response['Body'].read().decode('utf-8'))
                video_url = metadata.get('url') # e.g., Vimeo URL
                print(f"✅ DEBUG: Resolved video URL: {video_url}")
            except Exception as e:
                print(f"❌ DEBUG: Error reading metadata.json from S3: {str(e)}")
        
        # If it's notes, we might want to fetch the content if it's a text/markdown file
        elif file_type == 'notes' and (s3_key.endswith('.md') or s3_key.endswith('.txt')):
            try:
                print(f"🔍 DEBUG: Attempting to read notes from S3: {s3_key}")
                response = s3_client.get_object(Bucket=BUCKET, Key=s3_key)
                notes_content = response['Body'].read().decode('utf-8')
                print(f"✅ DEBUG: Successfully read notes content ({len(notes_content)} chars)")
            except Exception as e:
                print(f"❌ DEBUG: Error reading notes from S3: {str(e)}")

        # If no direct video_url was found (or it's not a metadata.json),
        # use the file-content proxy for actual files
        if not video_url and not notes_content:
            video_url = f"/api/file-content?key={s3_key}"
            print(f"ℹ️ DEBUG: Using proxy URL: {video_url}")

        items.append({
            "s3_key": s3_key,
            "video_url": video_url,
            "notes_content": notes_content,
            "uploaded_via": item.uploaded_via
        })

    return {
        "topic": content[0].topic_name or topic,
        "topic_slug": content[0].topic_slug,
        "file_type": file_type,
        "items": items
    }
