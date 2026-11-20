import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { createTranslator, getCatalog } from "@/i18n/translator";
import { MarketingLanding } from "@/app/components/marketing-landing";
import { getMarketingMetadata } from "@/app/marketing-metadata";

describe("MarketingLanding", () => {
  it("distinguishes cloud sign-in, desktop downloads, and self-hosted setup", () => {
    const translator = createTranslator("en", getCatalog("en"));
    const html = renderToStaticMarkup(createElement(MarketingLanding, { t: translator.t }));

    expect(html).toContain("A personal ledger for your bank accounts");
    expect(html).toContain('href="/login">Sign in to the cloud app');
    expect(html).toContain('href="https://github.com/vishal3152/Open-Money/releases">Download the desktop app');
    expect(html).toContain('href="https://github.com/vishal3152/Open-Money#self-hosted-sqlite">Read the self-hosting guide');
    expect(html).toContain('src="/marketing/dashboard-demo.png"');
    expect(html).toContain("sample data");
  });

  it("describes the core ledger features in terms of what users can do", () => {
    const translator = createTranslator("en", getCatalog("en"));
    const html = renderToStaticMarkup(createElement(MarketingLanding, { t: translator.t }));

    expect(html).toContain("mark it as disputed with the bank");
    expect(html).toContain("Totals are shown separately for each currency");
    expect(html).toContain("the two amounts determine the exchange rate");
    expect(html).toContain("starting principal, top-ups and withdrawals");
    expect(html).toContain("compare it with your ledger balance on that date");
    expect(html).toContain("see how many shares you hold in each trading account");
    expect(html).toContain("English, Simplified Chinese and Arabic");
  });

  it("explains how optional imports are set up and affect the ledger", () => {
    const translator = createTranslator("en", getCatalog("en"));
    const html = renderToStaticMarkup(createElement(MarketingLanding, { t: translator.t }));

    expect(html).toContain("Use either import on its own");
    expect(html).toContain("Import a bank or brokerage statement");
    expect(html).toContain("access token you generate in Open Money");
    expect(html).toContain("The assistant receives your statement file");
    expect(html).toContain("Open Money sends matching transaction details to the connected assistant");
    expect(html).toContain("The hosted app checks daily after setup");
    expect(html).toContain("For a local install, run the email sync background process");
    expect(html).toContain("No online banking password required");
    expect(html).toContain("Imported entries affect balances and share holdings as soon as they are saved");
    expect(html).toContain("remove duplicates or clear the flag before confirming");
    expect(html).toContain("confirming it also compares that balance with your ledger");
  });

  it("states where data is stored and who receives it", () => {
    const translator = createTranslator("en", getCatalog("en"));
    const html = renderToStaticMarkup(createElement(MarketingLanding, { t: translator.t }));

    expect(html).toContain("SQLite file on your computer");
    expect(html).toContain("Anyone who can reach the app can access the same ledger");
    expect(html).toContain("Postgres database managed by the hosting operator");
    expect(html).toContain("without connecting a bank, mailbox or AI service");
    expect(html).toContain("sends sender information and subject lines to the AI service you choose");
    expect(html).toContain("it also sends the message text");
    expect(html).toContain("a model running on your own machine");
  });

  it("answers common product questions in an FAQ section", () => {
    const translator = createTranslator("en", getCatalog("en"));
    const html = renderToStaticMarkup(createElement(MarketingLanding, { t: translator.t }));

    expect(html).toContain('id="faq"');
    expect(html).toContain("Frequently asked questions");
    expect(html).toContain("Does this connect to my bank?");
    expect(html).toContain("never ask for online banking credentials");
    expect(html).toContain("Is my financial data sent anywhere?");
    expect(html).toContain("Which mode should I pick?");
    expect(html).toContain("Can the desktop app use cloud mode?");
    expect(html).toContain("How do I back up my data?");
    expect(html).toContain("Do I have to use the AI features?");
  });

  it.each([
    ["en", "Bank Reconciliation", "cloud app"],
    ["zh", "银行对账", "云端版"],
    ["ar", "مطابقة الأرصدة البنكية", "التطبيق السحابي"]
  ] as const)("describes the product and cloud option in %s metadata", (locale, title, description) => {
    const metadata = getMarketingMetadata(locale);

    expect(metadata.title).toContain(title);
    expect(metadata.description).toContain(description);
  });
});
