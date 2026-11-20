import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { createTranslator, getCatalog } from "@/i18n/translator";
import { MarketingLanding } from "@/app/components/marketing-landing";
import { getMarketingMetadata } from "@/app/marketing-metadata";

describe("MarketingLanding", () => {
  it("explains the product and offers a clear path into the app", () => {
    const translator = createTranslator("en", getCatalog("en"));
    const html = renderToStaticMarkup(createElement(MarketingLanding, { t: translator.t }));

    expect(html).toContain("A privacy-first ledger on your own device");
    expect(html).toContain("Enter transactions and reconcile balances without connecting to a bank or AI service");
    expect(html).toContain("Compare your ledger with the bank’s reported balance");
    expect(html).toContain("mark a discrepancy as disputed");
    expect(html).toContain("Built as a Microsoft Money successor you can run yourself");
    expect(html).toContain("Totals stay separate by currency");
    expect(html).toContain('href="/login"');
    expect(html).toContain("Sign in to Open Money");
    expect(html).toContain('href="https://github.com/vishal3152/Open-Money/releases"');
    expect(html).toContain("Download desktop app");
    expect(html).toContain('href="https://github.com/vishal3152/Open-Money"');
    expect(html).toContain("Run it yourself");
    expect(html).toContain('src="/marketing/dashboard-demo.png"');
    expect(html).toContain("sample data");
  });

  it("covers the README feature areas and parallel-ledger rationale", () => {
    const translator = createTranslator("en", getCatalog("en"));
    const html = renderToStaticMarkup(createElement(MarketingLanding, { t: translator.t }));

    expect(html).toContain("An independent record next to your bank");
    expect(html).toContain("Keeping a parallel ledger gives you something to compare");
    expect(html).toContain("Accounts and transactions");
    expect(html).toContain("Record both legs as one transfer");
    expect(html).toContain("Track principal through opening, top-ups and withdrawals");
    expect(html).toContain("Compare the ledger with a bank-reported BalanceSnapshot");
    expect(html).toContain("Track whole-share trades and net holdings");
    expect(html).toContain("English, Simplified Chinese and Arabic");
    expect(html).toContain("Desktop or local browser");
    expect(html).toContain("Self-hosted SQLite");
    expect(html).toContain("one dataset per signed-in Owner");
  });

  it("explains statement import and email sync in plain language", () => {
    const translator = createTranslator("en", getCatalog("en"));
    const html = renderToStaticMarkup(createElement(MarketingLanding, { t: translator.t }));

    expect(html).toContain("Import a bank or brokerage statement");
    expect(html).toContain("Open MCP in Open Money to see how to connect a compatible AI assistant");
    expect(html).toContain("Ask about the transactions you have recorded");
    expect(html).toContain("Search by account, date, description, category, or money in and out");
    expect(html).toContain("matching recorded transaction details are returned to your connected assistant");
    expect(html).toContain("Your assistant reads the file and sends only the extracted entries to Open Money");
    expect(html).toContain("automatically imports transactions it can match to an account");
    expect(html).toContain("No online banking password required");
    expect(html).toContain("Imported entries count toward balances and holdings before confirmation");
    expect(html).toContain("Resolve flagged duplicates before confirming a batch");
    expect(html).toContain("creates a BalanceSnapshot and runs Reconciliation");
  });

  it("states the local hosted privacy boundaries without overpromising", () => {
    const translator = createTranslator("en", getCatalog("en"));
    const html = renderToStaticMarkup(createElement(MarketingLanding, { t: translator.t }));

    expect(html).toContain("Sign in to use the hosted app");
    expect(html).toContain("Run it your way");
    expect(html).toContain("Keep your ledger in a SQLite file");
    expect(html).toContain("No account or login in local mode");
    expect(html).toContain("No built-in analytics or crash reporting");
    expect(html).toContain("Open Money never asks for your online banking login");
    expect(html).toContain("Record transactions and reconcile balances offline");
    expect(html).toContain("use a model on your own machine, such as Ollama");
    expect(html).toContain("Email Alert Sync sends alert text to the AI service you configure");
    expect(html).toContain("Unclear alerts wait in the review queue");
  });

  it("provides localized search metadata for each supported language", () => {
    const english = getMarketingMetadata("en");
    const chinese = getMarketingMetadata("zh");
    const arabic = getMarketingMetadata("ar");

    expect(english.title).toContain("Privacy-First Multi-Currency Ledger");
    expect(english.description).toContain("privacy-first personal ledger");
    expect(chinese.title).toContain("隐私优先");
    expect(chinese.description).toContain("隐私优先");
    expect(arabic.title).toContain("الخصوصية أولاً");
    expect(arabic.description).toContain("الخصوصية أولاً");
  });
});
