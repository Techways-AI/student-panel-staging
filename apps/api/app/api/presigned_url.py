from fastapi import APIRouter, HTTPException, Query, Depends
from fastapi.responses import StreamingResponse
import boto3
from botocore.exceptions import ClientError
import os
from typing import Optional
from app.api.auth import get_current_user
from app.models.user import User

# Create router with authentication dependency
router = APIRouter(
    dependencies=[Depends(get_current_user)]  # 🔐 PROTECTS ALL ROUTES
)

# Get environment variables
BUCKET = os.getenv('S3_BUCKET')
AWS_ACCESS_KEY_ID = os.getenv('AWS_ACCESS_KEY_ID')
AWS_SECRET_ACCESS_KEY = os.getenv('AWS_SECRET_ACCESS_KEY')
AWS_REGION = os.getenv('AWS_REGION', 'ap-south-1')

# Validate required environment variables
if not BUCKET:
    raise ValueError("S3_BUCKET environment variable is required")
if not AWS_ACCESS_KEY_ID:
    raise ValueError("AWS_ACCESS_KEY_ID environment variable is required")
if not AWS_SECRET_ACCESS_KEY:
    raise ValueError("AWS_SECRET_ACCESS_KEY environment variable is required")

# Initialize S3 client
s3_client = boto3.client(
    's3',
    aws_access_key_id=AWS_ACCESS_KEY_ID,
    aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
    region_name=AWS_REGION
)

@router.get("/presigned-url")
async def get_presigned_url(key: str = Query(..., description="S3 object key"), current_user: User = Depends(get_current_user)):
    """DISABLED: Presigned URL generation removed - use new logic instead"""
    raise HTTPException(status_code=410, detail="Presigned URL generation has been removed. Please use the new file access logic.")

@router.get("/file-content")
async def get_file_content(key: str = Query(..., description="S3 object key")):
    """
    Proxy file content directly from S3
    """
    try:
        # Get the object from S3
        response = s3_client.get_object(Bucket=BUCKET, Key=key)
        
        # Determine content type
        content_type = response.get('ContentType', 'application/octet-stream')
        
        # Stream the content
        def generate():
            for chunk in response['Body'].iter_chunks():
                yield chunk
        
        return StreamingResponse(
            generate(),
            media_type=content_type,
            headers={
                'Content-Disposition': f'inline; filename="{os.path.basename(key)}"',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET',
                'Access-Control-Allow-Headers': '*',
            }
        )
        
    except ClientError as e:
        error_code = e.response['Error']['Code']
        if error_code == 'NoSuchKey':
            raise HTTPException(status_code=404, detail=f"File not found: {key}")
        elif error_code == 'NoSuchBucket':
            raise HTTPException(status_code=404, detail=f"Bucket not found: {BUCKET}")
        else:
            raise HTTPException(status_code=500, detail=f"S3 error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}") 

