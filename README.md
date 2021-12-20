JavaScript implementation of Boykov Kolmogorov maxflow mincut alorythm

# Installation

Copy `minCut.js` into your screeps branch directory.

# Usage

```js
const MinCut = require('minCut');
// require('minCut'); - or just like that if you keep registered MinCut class as global

const sources = [x1, y1, x2, y2 /* ... */ ];
const sinks = [x3, y3, x4, y4 /* ... */ ];

const data = new PathFinder.CostMatrix();
// ... set data CostMatrix values

// create minCut
const minCut = new MinCut(
	(x, y) => data.get(x, y) !== UNPATHABLE, // isPathableCallback
	50, 50, // width, height
	sources, sinks // sources (optional), sinks (optional)
);
// add sources and sinks if necessary
minCut.addSource(x5, y5);
minCut.addSink(x6, y6);

// run minCut
const maxFlow = minCut.run();
console.log('maxFlow:', maxFlow);

// get label for coords. MINCUT_UNPATHABLE | MINCUT_SINK | MINCUT_SOURCE | MINCUT_FREE
const label = minCut.getLabel(x, y);

// visualize
const visual = new RoomVisual(roomName);
for (let x = 0; x <= 49; x++) {
	for (let y = 0; y <= 49; y++) {
		const label = minCut.getLabel(x, y);
		if (label !== MINCUT_UNPATHABLE) { // 255
			let color = 'white';
			if (label === MINCUT_SINK) { // 2
				color = '#ff4232';
			} else if (label === MINCUT_SOURCE) { // 1
				color = 'yellow';
			}
			visual.circle(x, y, {radius: 0.2, fill: color, opacity: 0.6});
		}
	}
}
```

## Using MinCut.create(terrain, sources, options = {})

Sinks will be automatically set for pathable exit tiles.

### options.extendSinks

Default: `2`

Extend sinks by this radius (but only non-wall tiles). Set to `0` for disable. Sinks extending radius prioritizes over sources extending radius.

### options.extendSources

Default: `1`

Extend sources by this radius (but only non-wall tiles). Set to `0` for disable.

```js
const terrain = new Room.Terrain(roomName);
const sources = [];
const room = Game.rooms[roomName];
room.find(FIND_MY_SPAWNS).forEach(
	spawn => sources.push(spawn.pos.x, spawn.pos.y)
);

// example of adding tiles for mining containers and near controller (you should not set values for unpathable tiles)
// this code uses custom functions RoomPosition.lookInRange and Utils.getFreeSpots, so just as idea how to populate sources coords
/* room.find(FIND_SOURCES).forEach(source => {
	let item = source.pos.lookInRange(LOOK_STRUCTURES, 1)
		.find(item => (item.structure.structureType === STRUCTURE_CONTAINER));
	if (item) {
		const {x, y} = item.structure.pos;
		sources.push(x, y);
	}
});
Utils.getFreeSpots(room.controller.pos).forEach(pos => {
	sources.push(pos.x, pos.y);
}); */

minCut = MinCut.create(terrain, sources, {extendSources: 3});
```

## MinCut(isPathableCallback, width, height, sources = [], sinks = [])

### isPathableCallback(x, y): Boolean

Pathable callback. Must return `true` for pathable grid tiles and `false` for unpathable.

### width

Width of grid

### height

Height of grid

### sources

Default: `[]`

Array of sources, as plain coords array. example `[x1, y1, x2, y2, /* ... */ ]`

### sinks

Default: `[]`

Array of sinks, as plain coords array. example `[x1, y1, x2, y2, /* ... */ ]`


## addSource(x, y)

Set grid tile as source.

## addSink(x, y)

Set grid tile as sink.

## getLabel(x, y): Number

Returns label for given tile coords. One of constant: `MINCUT_UNPATHABLE, MINCUT_SINK, MINCUT_SOURCE, MINCUT_FREE`

## Constants
```
MINCUT_FREE = 0;
MINCUT_SOURCE = 1;
MINCUT_SINK = 2
MINCUT_UNPATHABLE = 255
```
