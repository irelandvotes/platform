"use client";

import { useState } from "react";
import AboutSection from "../AboutSection";

const faqs = [
  {
    question: "What is Ireland Votes?",
    answer:
      "Ireland Votes is an independent Irish political and electoral platform focused on elections, polling, constituency analysis, political data, and public-interest coverage. We aim to make Irish political information more modern, accessible, and easier to explore."
  },
  {
    question:
      "Is Ireland Votes affiliated with the Government?",
    answer:
      "No. Ireland Votes is fully independent and is not operated by, endorsed by, or officially connected to the Government of Ireland, the Electoral Commission, any political party, or any political candidate."
  },
  {
    question:
      "Where does your election data come from?",
    answer:
      "We use a mixture of official election results, public electoral datasets, polling organisations, media reporting, public archives, and internally built analysis and visualisations. During live counts and developing events, information may evolve over time as additional data becomes available."
  },
  {
    question:
      "Are your projections or forecasts official?",
    answer:
      "No. Any projections, polling analysis, seat estimates, swing models, or forecasts published by Ireland Votes are independent estimates and should not be treated as official results or governmental guidance."
  },
  {
    question:
      "Can I share Ireland Votes graphics or data?",
    answer:
      "Generally yes for discussion, journalism, commentary, educational use, and social sharing with appropriate attribution. However, Ireland Votes branding, written analysis, visual systems, and proprietary presentation formats remain protected. Commercial reuse, automated extraction, or republication at scale may require permission."
  },
  {
    question: "Do you sell personal data?",
    answer:
      "No. Ireland Votes does not sell Users’ personal data."
  },
  {
    question:
      "Do you share data with third parties?",
    answer:
      "Certain technical or operational information may be processed by trusted third-party providers that help us operate the Platform, such as hosting, analytics, security, or infrastructure providers. We do not share personal data for advertising resale purposes."
  },
  {
    question: "Do you use cookies?",
    answer:
      "Yes. Ireland Votes may use cookies, local storage, and similar technologies for functionality, analytics, performance monitoring, remembering preferences, and maintaining security."
  },
  {
    question: "Do you track analytics?",
    answer:
      "Yes. Like most modern websites, we may use analytics tools to better understand traffic, performance, feature usage, and technical reliability. This helps us improve the Platform over time."
  },
  {
    question:
      "Can I request a correction or removal of information?",
    answer:
      "Absolutely. If you believe something published on Ireland Votes is inaccurate, outdated, misleading, or infringes your rights, you can contact us for review. We take accuracy seriously and are happy to investigate legitimate concerns."
  },
  {
    question:
      "Can Ireland Votes remove access to the Platform?",
    answer:
      "Yes. We reserve the right to suspend or restrict access where necessary to protect platform integrity, security, infrastructure, legal compliance, or operational stability."
  },
  {
    question:
      "Why does Ireland Votes look different from other election websites?",
    answer:
      "Most political websites were designed for a very different internet era. Ireland Votes aims to combine modern design, interactive visualisation, and serious political data into a cleaner and more accessible experience."
  },
  {
    question:
      "Will Ireland Votes add accounts or subscriptions in the future?",
    answer:
      "Potentially. Ireland Votes is an evolving platform and additional features, tools, or services may be introduced over time."
  },
  {
    question:
      "Can journalists or organisations work with Ireland Votes?",
    answer:
      "Potentially yes. We are open to discussions involving media, research, educational, analytical, or commercial collaboration opportunities."
  },
  {
    question:
      "Is Ireland Votes available outside Ireland?",
    answer:
      "Yes. The Platform is publicly accessible internationally, although its primary focus is Irish and Northern Irish politics and elections."
  },
  {
    question:
      "How can I contact Ireland Votes?",
    answer:
      "General enquiries can be directed to contact@irelandvotes.com. Direct enquiries may also be sent to glen@irelandvotes.com or michael@irelandvotes.com."
  }
];

export default function FAQPage() {
  const [openIndex, setOpenIndex] =
    useState<number | null>(0);

  return (
    <AboutSection
      title="Frequently Asked Questions"
      subtitle="Answers to common questions about Ireland Votes, our data, privacy practices, and platform policies."
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "14px"
        }}
      >
        {faqs.map((faq, index) => {
          const open = openIndex === index;

          return (
            <div
              key={faq.question}
              style={{
                borderBottom:
                  "1px solid var(--border)",
                paddingBottom: "14px"
              }}
            >
              <button
                onClick={() =>
                  setOpenIndex(
                    open ? null : index
                  )
                }
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent:
                    "space-between",
                  gap: "20px",
                  textAlign: "left",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: "8px 0"
                }}
              >
                <div
                  style={{
                    fontSize: "20px",
                    fontWeight: 650,
                    lineHeight: 1.4,
                    color: "var(--text)"
                  }}
                >
                  {faq.question}
                </div>

<div
  style={{
    width: "28px",
    height: "28px",
    borderRadius: "999px",
    border:
      "1px solid var(--border)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    background:
      "var(--panel-2)",
    color: "#00dfef"
  }}
>
  {open ? (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
    >
      <path d="M5 12h14" />
    </svg>
  ) : (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
    >
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  )}
</div>
              </button>

              <div
                style={{
                  maxHeight: open
                    ? "500px"
                    : "0px",
                  overflow: "hidden",
                  opacity: open ? 1 : 0,
                  transition:
                    "all 0.25s cubic-bezier(0.22, 1, 0.36, 1)"
                }}
              >
                <div
                  style={{
                    paddingTop: "10px",
                    paddingRight: "48px",
                    color:
                      "var(--text-muted)",
                    fontSize: "16px",
                    lineHeight: 1.8
                  }}
                >
                  {faq.answer}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </AboutSection>
  );
}