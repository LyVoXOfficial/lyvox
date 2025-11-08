import type { Metadata } from "next";

type OpenGraphInput = Metadata["openGraph"];
type TwitterInput = Metadata["twitter"];

export type MetadataInput = {
  title?: string | null;
  description?: string | null;
  keywords?: string[] | null;
  canonical?: string | null;
  alternates?: Metadata["alternates"];
  openGraph?: OpenGraphInput;
  twitter?: TwitterInput;
};

const toArray = <T>(value: T | T[] | undefined): T[] | undefined => {
  if (!value) return undefined;
  return Array.isArray(value) ? value : [value];
};

const normalizeOpenGraph = (input?: OpenGraphInput): OpenGraphInput | undefined => {
  if (!input) return undefined;

  return {
    ...input,
    images: toArray(input.images),
  };
};

const normalizeTwitter = (input?: TwitterInput): TwitterInput | undefined => {
  if (!input) return undefined;

  return {
    ...input,
    images: toArray(input.images),
  };
};

export const generateMetadata = (config: MetadataInput): Metadata => {
  const metadata: Metadata = {};

  if (config.title) {
    metadata.title = config.title;
  }

  if (config.description) {
    metadata.description = config.description;
  }

  if (config.keywords?.length) {
    metadata.keywords = config.keywords;
  }

  const openGraph = normalizeOpenGraph(config.openGraph);
  if (openGraph) {
    metadata.openGraph = openGraph;
  }

  const twitter = normalizeTwitter(config.twitter);
  if (twitter) {
    metadata.twitter = twitter;
  }

  const alternates: Metadata["alternates"] = config.alternates
    ? { ...config.alternates }
    : undefined;
  if (config.canonical) {
    if (!alternates) {
      metadata.alternates = { canonical: config.canonical };
    } else {
      metadata.alternates = {
        ...alternates,
        canonical: config.canonical,
      };
    }
  } else if (alternates) {
    metadata.alternates = alternates;
  }

  return metadata;
};

