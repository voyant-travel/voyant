---
"@voyant-travel/media-react": patch
---

Polish the media library layout. Add standard page padding (`p-6`) to the
browse surface so it no longer sits flush against the shell edges, and move the
asset detail/edit form out of a permanent inline right column into a right-side
sheet that opens when an asset is selected and closes back to the grid. This
reclaims the horizontal space the empty "Select an asset" column wasted and
gives the edit form more room.
