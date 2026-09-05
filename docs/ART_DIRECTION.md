# Art direction

Original generated dark fantasy creatures. Muted ivory bone, oxidized teal spectral light, navy shadows, aged gold. The environment is an actual procedural 3D corridor; enemy artwork is used on billboards inside it.

## Enemy atlas

`dist/assets/enemies.webp`: 1254×1254, transparent RGBA, four 627×627 quadrants. Top left sentinel, top right witch, bottom left golem, bottom right warden. Keep the entire quadrant when sampling UVs. Original generation was converted to WebP for delivery without changing the content.

### Reusable generation prompt

One 2x2 enemy atlas with four equal square cells. Polished hand-painted dark fantasy game monsters, high contrast ivory bone, oxidized teal spectral glows, dark navy shadows, muted gold detailing. Each creature centered full/three-quarter body and fully within its own cell with generous 10% margin, isolated on transparent background, no text, no borders, no other scenery. Top-left: hooded skeletal dungeon sentinel holding rusty sword and round shield. Top-right: green-eyed ghostly witch holding a teal orb, trailing tattered robe. Bottom-left: hulking armored stone golem with amber cracks, compact heavy limbs. Bottom-right: regal spectral dungeon warden, angular black-and-bronze armor and large cyan enchanted blade. Distinct strong silhouettes. Gameplay billboard atlas, not a UI screenshot.

## Interface

Near-black navy, aged gold primary controls, blue defense, terracotta attack, green healing, gold focus. Serif chapter names and game title; system Japanese sans-serif for tactical labels. Five enemy predictions align directly above five player answers. Card statistics are live text, not baked into artwork.
