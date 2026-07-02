import { AccessForm } from "@/components/access-form";

export default async function AccessPage({
  searchParams
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  return <AccessForm nextPath={normalizeNextPath(params.next)} />;
}

function normalizeNextPath(value?: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}
