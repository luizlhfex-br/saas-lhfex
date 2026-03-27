export type PromotionMonitorChannel =
  | "instagram_hashtag"
  | "instagram_account"
  | "instagram_keyword"
  | "promotion_site"
  | "literary_site";

export const PROMOTION_MONITOR_CHANNEL_META: Record<
  PromotionMonitorChannel,
  { label: string; shortLabel: string; placeholder: string }
> = {
  instagram_hashtag: {
    label: "Hashtag do Instagram",
    shortLabel: "Hashtag",
    placeholder: "#sorteio, #giveaway, #promo",
  },
  instagram_account: {
    label: "Perfil do Instagram",
    shortLabel: "Perfil",
    placeholder: "@marcaoficial",
  },
  instagram_keyword: {
    label: "Palavra-chave do Instagram",
    shortLabel: "Palavra-chave",
    placeholder: "sorteio iphone, viagem, cupom",
  },
  promotion_site: {
    label: "Site promocional",
    shortLabel: "Site",
    placeholder: "https://site-da-campanha.com",
  },
  literary_site: {
    label: "Fonte literaria",
    shortLabel: "Literario",
    placeholder: "https://site-do-concurso.com",
  },
};

export type PromotionDiscoveryStatus = "new" | "reviewing" | "imported" | "dismissed";
