import { StructuredToolInterface } from "@langchain/core/tools";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";

export class RetrievalAgent {
  private agent;

  private constructor(agent) {
    this.agent = agent;
  }

  // Create a retrieval agent with a retriever tool and a language model
  static create(tools: StructuredToolInterface[]) {
    // Create a retrieval agent that has access to the retrieval tool.
    const retrievalAgent = createReactAgent({
      llm: new ChatOpenAI({ temperature: 0, model: "gpt-4o-mini" }),
      tools,
      stateModifier: [
        "Answer the user's question only based on context retrieved from provided tools.",
        "Only use the information provided by the tools.",
        "If you need more information, ask for it.",
      ].join(" "),
    });

    return new RetrievalAgent(retrievalAgent);
  }

  // Query the retrieval agent with a user question
  async query(query: string) {
    const { messages } = await this.agent.invoke({
      messages: [
        {
          role: "user",
          content: query,
        },
      ],
    });

    return messages.at(-1)?.content;
  }
}
