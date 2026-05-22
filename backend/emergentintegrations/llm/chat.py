import asyncio
import logging

import requests

logger = logging.getLogger(__name__)

class UserMessage:
    def __init__(self, text: str):
        self.text = text

class LlmResponse:
    def __init__(self, text: str):
        self.text = text

    def __str__(self):
        return self.text

class LlmChat:
    def __init__(self, api_key: str, session_id: str, system_message: str):
        self.api_key = api_key
        self.session_id = session_id
        self.system_message = system_message
        self.provider = "gemini"
        self.model_name = "gemini-1.5-flash"  # Default fallback model

    def with_model(self, provider: str, model_name: str):
        self.provider = provider
        # Map models if necessary, using gemini-1.5-flash for maximum compatibility
        if "gemini" in model_name:
            self.model_name = "gemini-1.5-flash"
        else:
            self.model_name = model_name
        return self

    async def send_message(self, message: UserMessage) -> LlmResponse:
        # Construct Gemini API call
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model_name}:generateContent?key={self.api_key}"
        
        headers = {
            "Content-Type": "application/json"
        }
        
        payload = {
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        {"text": message.text}
                    ]
                }
            ],
            "generationConfig": {
                "responseMimeType": "application/json"
            }
        }
        
        if self.system_message:
            payload["systemInstruction"] = {
                "parts": [
                    {"text": self.system_message}
                ]
            }

        # Perform the HTTP POST request in a separate thread to prevent event loop blocking
        def _post():
            return requests.post(url, headers=headers, json=payload, timeout=15)

        try:
            response = await asyncio.to_thread(_post)
            response.raise_for_status()
            res_json = response.json()
            
            # Extract generated text from Gemini's response structure
            candidates = res_json.get("candidates", [])
            if candidates:
                parts = candidates[0].get("content", {}).get("parts", [])
                if parts:
                    text = parts[0].get("text", "")
                    return LlmResponse(text)
            
            raise ValueError(f"Unexpected response structure from Gemini API: {res_json}")
            
        except Exception as e:
            logger.error(f"Gemini API request failed: {e}")
            raise e
