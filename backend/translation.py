from deep_translator import GoogleTranslator
from functools import lru_cache

@lru_cache(maxsize=1000)
def translate_text(text: str, target_lang: str = "en") -> str:
    """Translates text to target language with caching."""
    if not text or target_lang == "en":
        return text

    try:
        translator = GoogleTranslator(source='en', target=target_lang)
        result = translator.translate(text)
        print(f"Translated: {text} => {result} (en -> {target_lang})")
        return result if result else text
    except Exception as e:
        print(f"Translation error: {str(e)}")
        return text