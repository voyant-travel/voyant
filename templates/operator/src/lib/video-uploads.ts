import type { CreateVideoUploadInput, VideoUploadTicket } from "@voyantjs/cloud-sdk"
import { getVoyantCloudClient, type VoyantCloudEnv } from "./cloud-client.js"

/**
 * Default video upload handler for this template.
 *
 * Returns a one-shot TUS upload ticket that the client uploads the video bytes
 * to directly. To switch providers (e.g., upload through your own Cloudflare
 * Stream account or any TUS-compatible host), replace the body of this function
 * with one that constructs the equivalent ticket.
 */
export function createVideoUploadTicket(
  env: VoyantCloudEnv,
  input: CreateVideoUploadInput,
): Promise<VideoUploadTicket> {
  const client = getVoyantCloudClient(env)
  return client.video.videos.createUpload(input)
}
