import os, asyncio
from openai import OpenAI

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

async def complete(prompt: str) -> str:
    # Optional helper, not used for core logic (we rely on regex for speed/predictability).
    def _call():
        resp = client.chat.completions.create(
            model=os.getenv("OPENAI_MODEL","gpt-4o-mini"),
            messages=[
                {"role":"system","content":"You extract structured intents for finance and task logging."},
                {"role":"user","content": prompt}
            ],
            temperature=0
        )
        return resp.choices[0].message.content
    return await asyncio.to_thread(_call)
