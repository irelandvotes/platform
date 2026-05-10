import AboutSection from "../AboutSection";

export default function DisclaimerPage() {
  return (
    <AboutSection
      title="Disclaimer"
      subtitle="Important information regarding platform accuracy, licensing, and the use of electoral and political data."
    >
      <h2
        style={{
          fontSize: "24px",
          fontWeight: 700,
          marginBottom: "14px"
        }}
      >
        General Information
      </h2>

      Ireland Votes provides electoral,
      political, polling, and analytical
      information for informational and
      educational purposes only.

      <br /><br />

      While every effort is made to ensure
      the accuracy, consistency, and integrity
      of information presented across the platform,
      errors, omissions, delays, discrepancies,
      or formatting inconsistencies may occasionally
      occur.

      <br /><br />

      Ireland Votes does not guarantee the
      completeness, reliability, or absolute
      accuracy of any dataset, projection,
      calculation, forecast, polling average,
      or political analysis published on the platform.

      <br /><br />

      <h2
        style={{
          fontSize: "24px",
          fontWeight: 700,
          marginBottom: "14px",
          marginTop: "44px"
        }}
      >
        Data Sources
      </h2>

      Electoral and political datasets used
      throughout Ireland Votes may originate from
      official electoral authorities, public bodies,
      polling organisations, historical archives,
      media reporting, publicly accessible records,
      and third-party data providers.

      <br /><br />

      Ireland Votes may modify, restructure,
      standardise, aggregate, or reformat source
      datasets in order to provide consistent
      navigation, filtering, comparison,
      and analytical functionality across the platform.

      <br /><br />

      <h2
        style={{
          fontSize: "24px",
          fontWeight: 700,
          marginBottom: "14px",
          marginTop: "44px"
        }}
      >
        Licensing & Intellectual Property
      </h2>

      Certain datasets, maps, graphics,
      party identifiers, constituency structures,
      polling information, and statistical materials
      may remain subject to copyright, licensing,
      attribution requirements, or usage restrictions
      imposed by their original creators or publishers.

      <br /><br />

      Ireland Votes does not claim ownership
      over official public electoral results,
      publicly released polling figures,
      or externally sourced factual datasets
      unless explicitly stated otherwise.

      <br /><br />

      All platform branding, interface design,
      visual systems, original written analysis,
      data formatting structures, custom calculations,
      and proprietary presentation layers remain
      the intellectual property of Ireland Votes
      unless otherwise indicated.

      <br /><br />

      <h2
        style={{
          fontSize: "24px",
          fontWeight: 700,
          marginBottom: "14px",
          marginTop: "44px"
        }}
      >
        Use of Information
      </h2>

      Users should independently verify
      information where appropriate before relying
      upon any material for academic, journalistic,
      commercial, legal, electoral, or political purposes.

      <br /><br />

      By using Ireland Votes, users acknowledge
      that electoral interpretation, polling analysis,
      and political forecasting may involve uncertainty,
      estimation, evolving methodologies,
      and incomplete information.
    </AboutSection>
  );
}