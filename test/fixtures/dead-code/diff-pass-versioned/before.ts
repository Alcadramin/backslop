export default function SigningPage() {
  const data = useLoaderData();
  return <SigningPageV1 data={data} />;
}

const SigningPageV1 = ({ data }: Props) => <Legacy data={data} />;
