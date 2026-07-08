import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const submitLead = createServerFn({ method: "POST" })
  .validator(
    z.object({
      name: z.string(),
      email: z.string(),
      company: z.string(),
      problem_text: z.string(),
      source: z.enum(["voice", "form"]),
      urgency: z.string(),
      tools: z.string().optional(),
      website: z.string().optional(),
      persona: z.string().optional(),
      language: z.string().optional(),
      volume: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    try {
      const { name, email, company, problem_text, source, urgency, tools, website, persona, language, volume } = data;

      // Build notification text
      const summaryText =
        `*New Lead Captured (${source})*\n` +
        `*Name:* ${name}\n` +
        `*Email:* ${email}\n` +
        `*Company:* ${company}\n` +
        `*Website:* ${website || "None"}\n` +
        `*Persona:* ${persona || "None"}\n` +
        `*Language:* ${language || "None"}\n` +
        `*Volume:* ${volume || "None"}\n` +
        `*Urgency:* ${urgency}\n` +
        `*Tools:* ${tools || "None specified"}\n` +
        `*Problem statement:*\n> ${problem_text}`;

      console.log("==========================================");
      console.log(`LEAD CAPTURED VIA ${source.toUpperCase()}:`);
      console.log(`Name: ${name}`);
      console.log(`Email: ${email}`);
      console.log(`Company: ${company}`);
      console.log(`Website: ${website || "N/A"}`);
      console.log(`Persona: ${persona || "N/A"}`);
      console.log(`Language: ${language || "N/A"}`);
      console.log(`Volume: ${volume || "N/A"}`);
      console.log(`Urgency: ${urgency}`);
      console.log(`Tools: ${tools || "N/A"}`);
      console.log(`Problem: ${problem_text}`);
      console.log("==========================================");

      const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
      if (slackWebhookUrl) {
        try {
          const res = await fetch(slackWebhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: summaryText }),
          });
          if (!res.ok) {
            console.error(`Failed to post to Slack: ${res.statusText}`);
          } else {
            console.log("Lead successfully posted to Slack.");
          }
        } catch (slackErr) {
          console.error("Error posting lead to Slack:", slackErr);
        }
      } else {
        console.log(
          "Slack webhook not configured (SLACK_WEBHOOK_URL is missing). Fallback to console logging completed.",
        );
      }

      return { success: true };
    } catch (error) {
      console.error("Error in submitLead server function:", error);
      const errorMessage = error instanceof Error ? error.message : "Internal server error";
      return { success: false, error: errorMessage };
    }
  });
