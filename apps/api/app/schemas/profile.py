from pydantic import BaseModel

class ProfileRequest(BaseModel):
    name: str
    gender: str
    college_name: str
    university: str
    email: str
    phone: str
    whatsapp: bool

class ProfileResponse(BaseModel):
    success: bool 

