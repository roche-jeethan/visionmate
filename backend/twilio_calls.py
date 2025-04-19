# twilio_calls.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from twilio.rest import Client
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

router = APIRouter()

# Twilio credentials from environment variables
ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
TWILIO_NUMBER = os.getenv("TWILIO_PHONE_NUMBER")
TWILIO_WHATSAPP_NUMBER = os.getenv("TWILIO_WHATSAPP_NUMBER")

client = Client(ACCOUNT_SID, AUTH_TOKEN)

class CallRequest(BaseModel):
    to: str

@router.post("/make-call")
def make_call(request: CallRequest):
    call = client.calls.create(
        to=request.to,
        from_=TWILIO_NUMBER,
        twiml='<Response><Say>Hello How Are You</Say></Response>'
    )
    return {"sid": call.sid, "status": call.status}

class SMSRequest(BaseModel):
    to: str
    message: str
    
@router.post("/send-sms")
def send_sms(request: SMSRequest):
    try:
        message = client.messages.create(
            to=request.to,
            from_=TWILIO_NUMBER,
            body=request.message
        )
        return {"sid": message.sid, "status": message.status}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class WhatsAppRequest(BaseModel):
    to: str
    message: str

@router.post("/send-whatsapp")
def send_whatsapp_message(request: WhatsAppRequest):
    try:
        message = client.messages.create(
            to=f"whatsapp:{request.to}",
            from_ = f"whatsapp:{TWILIO_WHATSAPP_NUMBER}",
            body=request.message
        )
        return {"sid": message.sid, "status": message.status}
    except Exception as e:
        print("Twilio error:", str(e))  # ✅ Add logging
        raise HTTPException(status_code=500, detail=str(e))