export default function SigningPage() {
  const data = useLoaderData();
  return data.version === 2 ? <SigningPageV2 data={data} /> : <SigningPageV1 data={data} />;
}

const SigningPageV1 = ({ data }: Props) => <Legacy data={data} />;

const SigningPageV2 = ({ data }: Props) => <Signing data={data} />;
