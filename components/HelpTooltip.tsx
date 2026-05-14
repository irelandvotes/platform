export default function HelpTooltip({
  text
}: {
  text: string;
}) {

  return (
    <span
      style={{
        marginLeft: "4px",
        cursor: "help",
        opacity: 0.6
      }}
      title={text}
    >
      ?
    </span>
  );

}