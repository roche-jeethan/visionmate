from deep_translator import GoogleTranslator
from functools import lru_cache
import asyncio

@lru_cache(maxsize=1000)
def translate_text_sync(text: str, target_lang: str = "en") -> str:
    """Synchronous translation with caching."""
    if not text or not target_lang:
        return text
    try:
        if target_lang == "en":
            return text
        translator = GoogleTranslator(source='auto', target=target_lang)
        return translator.translate(text)
    except Exception as e:
        print(f"Translation error: {str(e)}")
        return text

async def translate_text(text: str, target_lang: str = "en") -> str:
    """Asynchronous wrapper for translation."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, translate_text_sync, text, target_lang)