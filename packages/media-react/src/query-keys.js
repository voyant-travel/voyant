export const mediaQueryKeys = {
  all: ["voyant", "media-library"],
  assets: () => [...mediaQueryKeys.all, "assets"],
  assetsList: (filters) => [...mediaQueryKeys.assets(), "list", filters],
  asset: (id) => [...mediaQueryKeys.assets(), "detail", id],
  folders: () => [...mediaQueryKeys.all, "folders"],
  foldersList: (filters) => [...mediaQueryKeys.folders(), "list", filters],
  folder: (id) => [...mediaQueryKeys.folders(), "detail", id],
  usage: () => [...mediaQueryKeys.all, "usage"],
  usageList: (filters) => [...mediaQueryKeys.usage(), "list", filters],
  assetUsage: (assetId) => [...mediaQueryKeys.usage(), "asset", assetId],
}
