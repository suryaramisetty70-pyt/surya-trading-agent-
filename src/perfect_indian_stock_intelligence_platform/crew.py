import os
import sys

# Load GROQ_API_KEY from .env file — set it there, never hardcode here!
os.environ.setdefault("GROQ_API_KEY", os.environ.get("GROQ_API_KEY", ""))

# Remove GEMINI_API_KEY to ensure no library attempts to call Google
if "GEMINI_API_KEY" in os.environ:
    del os.environ["GEMINI_API_KEY"]

import litellm
# Monkey patch litellm.completion to automatically strip cache_breakpoint from system messages for Groq compatibility
_original_litellm_completion = litellm.completion

def _safe_litellm_completion(*args, **kwargs):
    if "messages" in kwargs and isinstance(kwargs["messages"], list):
        for msg in kwargs["messages"]:
            if isinstance(msg, dict):
                msg.pop("cache_breakpoint", None)
    return _original_litellm_completion(*args, **kwargs)

litellm.completion = _safe_litellm_completion
litellm.drop_params = True

from dotenv import load_dotenv
load_dotenv()

from crewai import LLM, Agent, Crew, Process, Task
from crewai.project import CrewBase, agent, crew, task, before_kickoff
from .tools.indian_stock_tool import IndianStockDataTool
from .tools.wikipedia_tool import WikipediaTool

def get_llm():
    """Returns Groq Llama 3.3 70B as the primary LLM model for ultra-fast execution with zero rate-limit errors."""
    return LLM(
        model="groq/llama-3.3-70b-versatile",
        api_key=os.environ["GROQ_API_KEY"],
        temperature=0.2
    )

@CrewBase
class PerfectIndianStockIntelligencePlatformCrew:
    """PerfectIndianStockIntelligencePlatform crew for 100% accurate Indian Stock Analysis & Trading Guidance using Groq"""

    @before_kickoff
    def prepare_inputs(self, inputs):
        if inputs is None:
            inputs = {}
        if "indian_stock_ticker" not in inputs or not inputs["indian_stock_ticker"]:
            inputs["indian_stock_ticker"] = "RELIANCE"
        return inputs

    @agent
    def indian_investment_advisory_specialist(self) -> Agent:
        return Agent(
            config=self.agents_config["indian_investment_advisory_specialist"],
            tools=[IndianStockDataTool(), WikipediaTool()],
            reasoning=False,
            inject_date=True,
            allow_delegation=False,
            max_iter=10,
            max_rpm=15,
            llm=get_llm(),
        )

    @agent
    def perfect_market_dashboard_specialist(self) -> Agent:
        return Agent(
            config=self.agents_config["perfect_market_dashboard_specialist"],
            tools=[IndianStockDataTool()],
            reasoning=False,
            inject_date=True,
            allow_delegation=False,
            max_iter=10,
            max_rpm=15,
            llm=get_llm(),
        )

    @agent
    def fundamental_research_expert(self) -> Agent:
        return Agent(
            config=self.agents_config["fundamental_research_expert"],
            tools=[IndianStockDataTool(), WikipediaTool()],
            reasoning=False,
            inject_date=True,
            allow_delegation=False,
            max_iter=10,
            max_rpm=15,
            llm=get_llm(),
        )

    @agent
    def technical_analysis_pro(self) -> Agent:
        return Agent(
            config=self.agents_config["technical_analysis_pro"],
            tools=[IndianStockDataTool()],
            reasoning=False,
            inject_date=True,
            allow_delegation=False,
            max_iter=10,
            max_rpm=15,
            llm=get_llm(),
        )

    @task
    def real_time_market_dashboard(self) -> Task:
        return Task(
            config=self.tasks_config["real_time_market_dashboard"],
            markdown=True,
        )

    @task
    def fundamental_stock_analysis(self) -> Task:
        return Task(
            config=self.tasks_config["fundamental_stock_analysis"],
            markdown=True,
        )

    @task
    def technical_analysis_report(self) -> Task:
        return Task(
            config=self.tasks_config["technical_analysis_report"],
            markdown=True,
        )

    @task
    def master_investment_report(self) -> Task:
        return Task(
            config=self.tasks_config["master_investment_report"],
            markdown=True,
            output_file="output/master_investment_report.md"
        )

    @crew
    def crew(self) -> Crew:
        """Creates the PerfectIndianStockIntelligencePlatform crew"""
        return Crew(
            agents=self.agents,
            tasks=self.tasks,
            process=Process.sequential,
            verbose=True,
        )
