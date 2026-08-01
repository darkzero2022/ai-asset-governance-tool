import type { AIAsset } from "@prisma/client";

export function buildSpdxDocument(assets: AIAsset[]) {
  return {
    spdxVersion: "SPDX-2.3",
    dataLicense: "CC0-1.0",
    SPDXID: "SPDXRef-DOCUMENT",
    name: "AI Asset Governance Export",
    documentNamespace: `https://aibom.local/spdx/${Date.now()}`,
    creationInfo: {
      created: new Date().toISOString(),
      creators: ["Tool: AI Asset Governance Tool-0.1.0"],
    },
    packages: assets.map((asset) => ({
      name: asset.name,
      SPDXID: `SPDXRef-AIAsset-${asset.id}`,
      versionInfo: asset.version,
      supplier: `Organization: ${asset.supplier}`,
      downloadLocation: "NOASSERTION",
      filesAnalyzed: false,
      licenseConcluded: asset.license ?? "NOASSERTION",
      licenseDeclared: asset.license ?? "NOASSERTION",
      copyrightText: "NOASSERTION",
      summary: `AI asset type=${asset.type}; hosting=${asset.hostingModel}; status=${asset.status}`,
    })),
    relationships: assets.map((asset) => ({
      spdxElementId: "SPDXRef-DOCUMENT",
      relationshipType: "DESCRIBES",
      relatedSpdxElement: `SPDXRef-AIAsset-${asset.id}`,
    })),
  };
}
