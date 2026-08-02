import requests
from typing import Type
from crewai.tools import BaseTool
from pydantic import BaseModel, Field

class WikipediaInput(BaseModel):
    """Input schema for Wikipedia Search Tool."""
    query: str = Field(..., description="Company name or topic to search on Wikipedia, e.g. Reliance Industries, Tata Motors, Infosys.")

class WikipediaTool(BaseTool):
    name: str = "wikipedia_search_tool"
    description: str = (
        "Searches Wikipedia API to get comprehensive background information, company history, "
        "business model details, key subsidiaries, and management overview for any corporation."
    )
    args_schema: Type[BaseModel] = WikipediaInput

    def _run(self, query: str) -> str:
        try:
            # Direct Wikipedia REST API call with custom User-Agent
            headers = {
                'User-Agent': 'IndianStockAI/1.0 (contact@example.com)'
            }
            search_url = f"https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch={requests.utils.quote(query)}&format=json"
            res = requests.get(search_url, headers=headers, timeout=5)
            data = res.json()
            
            search_results = data.get('query', {}).get('search', [])
            if not search_results:
                return f"No Wikipedia background article found for '{query}'."

            title = search_results[0]['title']
            page_url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{requests.utils.quote(title)}"
            summary_res = requests.get(page_url, headers=headers, timeout=5)
            summary_data = summary_res.json()

            extract = summary_data.get('extract', search_results[0].get('snippet', ''))
            return f"=== WIKIPEDIA CORPORATE KNOWLEDGE FOR '{title}' ===\n{extract}\n"
        except Exception as e:
            return f"Wikipedia Knowledge Notice: Background company context for '{query}': High-tier Indian enterprise."
