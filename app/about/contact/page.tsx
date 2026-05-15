import AboutSection from "../AboutSection";

function ContactCard({
  name,
  title,
  email
}: {
  name: string;
  title: string;
  email: string;
}) {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: "28px",
        padding: "28px",
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.015))",
        border: "1px solid rgba(255,255,255,0.08)",
        backdropFilter: "blur(10px)",
        boxShadow:
          "0 10px 40px rgba(0,0,0,0.18)"
      }}
    >
      {/* subtle glow */}
      <div
        style={{
          position: "absolute",
          top: "-80px",
          right: "-80px",
          width: "220px",
          height: "220px",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(0,223,239,0.12), transparent 72%)",
          pointerEvents: "none"
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1
        }}
      >
        <div
          style={{
            fontSize: "28px",
            fontWeight: 700,
            letterSpacing: "-0.03em",
            marginBottom: "10px"
          }}
        >
          {name}
        </div>

        <div
          style={{
            fontSize: "13px",
            textTransform: "uppercase",
            opacity: 0.56,
            marginBottom: "26px"
          }}
        >
          {title}
        </div>

        <a
          href={`mailto:${email}`}
          style={{
            fontSize: "16px",
            color: "#00dfef",
            textDecoration: "none",
            wordBreak: "break-word"
          }}
        >
          {email}
        </a>
      </div>
    </div>
  );
}

export default function ContactPage() {
  return (
    <AboutSection
      title="Contact"
      subtitle="Get in touch with Ireland Votes."
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "56px"
        }}
      >
        {/* Intro */}
        <div
          style={{
            maxWidth: "720px"
          }}
        >
          Ireland Votes welcomes feedback,
          corrections, collaboration enquiries,
          media requests, and general questions
          regarding the platform.

          <br />
          <br />

          For direct enquiries, you can contact
          either member of the team below.
        </div>

        {/* Key Contacts */}
        <div>
          <div
            style={{
              fontSize: "14px",
              textTransform: "uppercase",
              letterSpacing: "0.14em",
              opacity: 0.55,
              marginBottom: "22px"
            }}
          >
            Key Contacts
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "24px"
            }}
          >
            <ContactCard
              name="Glen"
              title="Co-Founder, Managing Director"
              email="glen@irelandvotes.com"
            />

            <ContactCard
              name="Michael"
              title="Co-Founder, Managing Director"
              email="michael@irelandvotes.com"
            />
          </div>
        </div>

        {/* General enquiries */}
        <div
          style={{
            borderTop:
              "1px solid rgba(255,255,255,0.08)",
            paddingTop: "36px"
          }}
        >
          <div
            style={{
              fontSize: "14px",
              textTransform: "uppercase",
              letterSpacing: "0.14em",
              opacity: 0.55,
              marginBottom: "24px"
            }}
          >
            General Contact Information
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "26px"
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "13px",
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  opacity: 0.5,
                  marginBottom: "8px"
                }}
              >
                General enquiries
              </div>

              <a
                href="mailto:contact@irelandvotes.com"
                style={{
                  color: "#00dfef",
                  textDecoration: "none",
                  fontSize: "17px"
                }}
              >
                contact@irelandvotes.com
              </a>
            </div>

            <div>
              <div
                style={{
                  fontSize: "13px",
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  opacity: 0.5,
                  marginBottom: "8px"
                }}
              >
                Store enquiries
              </div>

              <a
                href="mailto:store@irelandvotes.com"
                style={{
                  color: "#00dfef",
                  textDecoration: "none",
                  fontSize: "17px"
                }}
              >
                store@irelandvotes.com
              </a>
            </div>
          </div>
        </div>
      </div>
    </AboutSection>
  );
}