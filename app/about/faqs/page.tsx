"use client";

import { useState } from "react";
import AboutSection from "../AboutSection";

const faqs = [
  {
    question: "What is Ireland Votes?",
    answer:
      "Ireland Votes is an independent political and electoral data platform focused on elections, polling, analysis, and public-interest coverage on the island of Ireland. We aim to make political information more accessible and interactive."
  },
  {
    question:
      "Is Ireland Votes affiliated with the Government?",
    answer:
      "No. Ireland Votes is an independent entity and is not operated by, endorsed by, or officially connected to the Government of Ireland, the Electoral Commission, any political party, or any political candidate."
  },
  {
    question:
      "Where does Ireland Votes source its data?",
    answer:
      "We use a mixture of official election results, public electoral datasets, polling organisations, media reporting, public archives, and internally built analysis and visualisations. During live counts and developing events, information may evolve over time as additional data becomes available."
  },
  {
    question:
      "Are Ireland Votes projections or forecasts official results?",
    answer:
      "No. Any projections, polling analysis, seat estimates, swing models, or forecasts published by Ireland Votes are independent estimates and should not be treated as official results."
  },
  {
    question:
      "Can I share Ireland Votes graphics or data?",
    answer:
      "Generally yes for discussion, journalism, commentary, educational use, and social sharing with appropriate attribution. However, Ireland Votes branding, written analysis, visual systems, and proprietary presentation formats remain protected. Commercial reuse, automated extraction, or republication requires credit and may require permission."
  },
  {
    question: "Does Ireland Votes sell personal data?",
    answer:
      "No. Ireland Votes does not sell our Users’ personal data."
  },
  {
    question:
      "Does Ireland Votes share data with third parties?",
    answer:
      "Certain technical or operational information may be processed by trusted third-party providers that help us operate the Platform, such as hosting, analytics, security, or infrastructure providers. We do not share personal data for advertising resale purposes."
  },
  {
    question: "Does Ireland Votes use cookies?",
    answer:
      "Yes. Ireland Votes may use cookies, local storage, and similar technologies for functionality, analytics, performance monitoring, remembering preferences, and maintaining security."
  },
  {
    question: "Does Ireland Votes track analytics?",
    answer:
      "Yes. Like most modern websites, we may use analytics tools to better understand traffic, performance, feature usage, and technical reliability. This helps us improve the Platform over time."
  },
  {
    question:
      "Does Ireland Votes allow users to request corrections or removal of information?",
    answer:
      "Absolutely. If you believe something published on Ireland Votes is inaccurate, outdated, misleading, or infringes your rights, you can contact us for review. We take accuracy seriously and are happy to investigate legitimate concerns."
  },
  {
    question:
      "Can Ireland Votes remove access to the Platform?",
    answer:
      "Yes. Ireland Votes reserves the right to suspend or restrict access where necessary to protect platform integrity, security, infrastructure, legal compliance, or operational stability."
  },
{
  question:
    "What makes Ireland Votes different?",
  answer:
    "Ireland Votes focuses on presenting election data through interactive maps, live visualisations, and a cleaner interface designed to make political information easier to follow."
},
  {
    question:
      "Will Ireland Votes add accounts and/or premium subscriptions in the future?",
    answer:
      "Yes. Ireland Votes is an evolving platform and additional features, tools, or services may be introduced over time We are currently exploring options for a premium tier."
  },
  {
    question:
      "Does Ireland Votes allow individuals or organisations to work with it in a professional capacity?",
    answer:
      "Potentially yes. We are open to discussions involving media, research, educational, analytical, or commercial collaboration opportunities."
  },
  {
    question:
      "Is Ireland Votes available outside Ireland?",
    answer:
      "Yes. The Platform is publicly accessible internationally, although its primary focus is politics and elections on the island of Ireland. Ireland Votes may sometimes cover foreign-related elections when citizens of that country reside in Ireland and can vote in an election occuring outside of Ireland."
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