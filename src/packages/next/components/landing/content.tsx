import { Row, Col } from "antd";
import { ReactNode } from "react";
import SignIn from "components/landing/sign-in";
import Image from "./image";

interface Props {
  title: ReactNode;
  subtitle: ReactNode;
  description?: ReactNode;
  logo?: ReactNode | string | StaticImageData;
  image?: string | StaticImageData;
  alt?: string;
  startup?: ReactNode;
  caption?: string;
}

function Logo({ logo, title }) {
  if (!logo) return null;
  if (typeof logo == "string" || logo?.src != null) {
    return <Image src={logo} width={200} alt={`${title} logo`} />;
  }
  return logo;
}

export default function Content({
  title,
  subtitle,
  description,
  logo,
  image,
  alt,
  startup,
  caption,
}: Props) {
  return (
    <div style={{ padding: "30px 0" }}>
      <Row>
        <Col
          sm={10}
          xs={24}
          style={{
            display: "flex",
            alignItems: "center",
            paddingTop: "15px",
          }}
        >
          <div
            style={{ textAlign: "center", margin: "auto", padding: "0 10%" }}
          >
            <Logo logo={logo} title={title} />
            <br />
            <br />

            <h1 style={{ color: "#333" }}>{title}</h1>
            <h3 style={{ color: "#333" }}>{subtitle}</h3>
            <div style={{ color: "#666" }}>{description}</div>
          </div>
        </Col>
        <Col sm={14} xs={24}>
          {image && (
            <>
              <Image src={image} style={{ padding: "15px" }} alt={alt} />
              <div
                style={{ textAlign: "center", color: "#444", fontSize: "12pt" }}
              >
                {caption}
              </div>
            </>
          )}
        </Col>
      </Row>
      <SignIn startup={startup ?? title} hideFree={true} />
    </div>
  );
}
