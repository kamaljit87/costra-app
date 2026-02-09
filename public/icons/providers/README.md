# Cloud provider icons

Drop your own **SVG** or **PNG** icons here to override the built-in provider icons. The app will use these files when present and fall back to built-in icons if a file is missing or fails to load.

## Filenames

Use these exact names (lowercase, no spaces). Either `.svg` or `.png` is fine.

| Provider       | Filename       |
|----------------|----------------|
| AWS            | `aws.svg` or `aws.png` |
| Microsoft Azure| `azure.svg` or `azure.png` |
| Google Cloud   | `gcp.svg` or `gcp.png` |
| DigitalOcean   | `digitalocean.svg` or `digitalocean.png` |
| Linode / Akamai| `linode.svg` or `linode.png` |
| Vultr          | `vultr.svg` or `vultr.png` |
| IBM Cloud      | `ibm.svg` or `ibm.png` |

## Recommendations

- **Size:** Icons are scaled by the app; 24×24 or 32×32 px (or 1:1 SVG viewBox) works well.
- **Format:** Prefer SVG for sharp scaling; PNG is supported as fallback.
- **Naming:** Keep the filenames above. Only these files are looked up.

After adding or changing files, refresh the app (and hard-reload if needed) to see updates.
