import { Row, Col } from "antd";
import { Icon, IconName } from "@cocalc/frontend/components/icon";
import { CSSProperties, ReactNode } from "react";
import { MediaURL } from "./util";

const showcase = {
  width: "100%",
  boxShadow: "2px 2px 4px rgb(0 0 0 / 25%), 0 2px 4px rgb(0 0 0 / 22%)",
  borderRadius: "3px",
} as CSSProperties;

interface Props {
  anchor: string;
  icon?: IconName;
  title: ReactNode;
  image?: string;
  alt: string;
  video?: string | string[];
  caption?: ReactNode;
  children: ReactNode;
  rows?: boolean; // if given show as two rows instead of a single row and two columns
}

export default function Info({
  anchor,
  icon,
  title,
  image,
  alt,
  video,
  caption,
  children,
  rows,
}: Props) {
  const head = (
    <h2 id={anchor}>
      {icon && (
        <span style={{ fontSize: "24pt", marginRight: "5px" }}>
          <Icon name={icon} />{" "}
        </span>
      )}
      {title}
    </h2>
  );

  let graphic: ReactNode = null;
  if (image != null) {
    graphic = (
      <img style={showcase} src={MediaURL(image)} alt={alt ?? caption} />
    );
  } else if (video != null) {
    if (typeof video == "string") video = [video];
    verifyHasMp4(video);
    graphic = (
      <div style={{ position: "relative", width: "100%" }}>
        <video style={showcase} loop controls>
          {sources(video)}
        </video>
      </div>
    );
  }
  if (graphic != null && caption != null) {
    graphic = (
      <div>
        {graphic}
        <br />
        <br />
        <div style={{ textAlign: "center", color: "#666", fontSize: "13pt" }}>
          {caption}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "60px 5%", background: "white", fontSize: "11pt" }}>
      {graphic && !rows ? (
        <>
          {head}
          <Row>
            <Col
              lg={9}
              style={{
                border: "1px solid white",
                background: "#fafafa",
                borderRadius: "5px",
                padding: "20px",
                marginBottom: "15px",
                display: "flex",
                justifyContent: "center",
                alignContent: "center",
                flexDirection: "column",
              }}
            >
              {children}
            </Col>
            <Col lg={15} style={{ padding: "0 30px" }}>
              <div>{graphic}</div>
            </Col>
          </Row>
        </>
      ) : (
        <div style={{ width: "100%" }}>
          <div style={{ maxWidth: "900px", margin: "0 auto" }}>
            <div style={{ background: "#fafafa", padding: "20px" }}>
              <div style={{ textAlign: "center" }}>{head}</div>
              <div
                style={{ margin: "auto", maxWidth: rows ? "600px" : undefined }}
              >
                {children}
              </div>
            </div>
            {rows && <div style={{ margin: "15px 0" }}>{graphic}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function sources(video: string[]) {
  const v: JSX.Element[] = [];
  for (const x of video) {
    v.push(<source key={x} src={MediaURL(x)} />);
  }
  return v;
}

function verifyHasMp4(video: string[]) {
  for (const x of video) {
    if (x.endsWith(".mp4")) {
      return;
    }
  }
  console.warn(
    "include mp4 format for the video, so that it is viewable on iOS!!",
    video
  );
}

interface HeadingProps {
  children: ReactNode;
  description?: ReactNode;
}

Info.Heading = ({ children, description }: HeadingProps) => {
  return (
    <div
      style={{
        textAlign: "center",
        margin: "40px",
      }}
    >
      <h1
        style={{
          fontSize: "400%",
          color: "#444",
        }}
      >
        {children}
      </h1>
      <div style={{ fontSize: "13pt", color: "#666" }}>{description}</div>
    </div>
  );
};
