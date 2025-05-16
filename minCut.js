// github: https://github.com/NesCafe62/screeps-boykov-kolmogorov-mincut

PathFinder.CostMatrix.prototype.setFast = function(x, y, value) {
	this._bits[x * 50 + y] = value;
};

const DIRECTION_TO_OFFSET = [
	0, 0,
	0, -1,
	1, -1,
	1, 0,
	1, 1,
	0, 1,
	-1, 1,
	-1, 0,
	-1, -1,
];

const LABEL_FREE = 0;
const LABEL_SOURCE = 1;
const LABEL_SINK = 2;
const LABEL_UNPATHABLE = 255;

const PARENT_NONE = 0;
const PARENT_TERMINAL = 9;


class MinCut {

	constructor(isPathableCallback, width, height, sources = [], sinks = []) {
		this.width = width;
		this.height = height;
		const length = width * height;

		this.labels = new Uint8Array(length);
		this.capacity = new Uint8Array(length);
		this.parents = new Uint8Array(length);
		this.timestamps = new Uint8Array(length);

		this.active = [];
		this.orphans = [];

		for (let x = 0; x < width; x++) {
			for (let y = 0; y < height; y++) {
				if (!isPathableCallback(x, y)) {
					this.labels[y * width + x] = LABEL_UNPATHABLE;
					continue;
				}
				let directions = 0;
				for (let i = 1; i <= 8; i++) {
					const px = x + DIRECTION_TO_OFFSET[i * 2];
					const py = y + DIRECTION_TO_OFFSET[i * 2 + 1];
					if (isPathableCallback(px, py)) {
						directions += (1 << (i - 1));
					}
				}
				if (directions > 0) {
					if (directions & 0xC1 === 0xC1) { // 193 = 1 + 64 + 128
						directions -= 128;
					}
					if (directions & 7 === 7) { // 1 + 2 + 4
						directions -= 2;
					}
					if (directions & 0x1C === 0x1C) { // 28 = 4 + 8 + 16
						directions -= 8;
					}
					if (directions & 0x70 === 0x70) { // 112 = 16 + 32 + 64
						directions -= 32;
					}
					this.capacity[y * width + x] = directions;
				}
			}
		}

		for (let i = 0; i < sources.length; i += 2) {
			const x = sources[i];
			const y = sources[i + 1];
			this.addSource(x, y);
		}
		for (let i = 0; i < sinks.length; i += 2) {
			const x = sinks[i];
			const y = sinks[i + 1];
			this.addSink(x, y);
		}
	}

	addSource(x, y) {
		const index = y * this.width + x;
		this.labels[index] = LABEL_SOURCE;
		this.parents[index] = PARENT_TERMINAL;
		this.active.push(x, y);
	}

	addSink(x, y) {
		const index = y * this.width + x;
		this.labels[index] = LABEL_SINK;
		this.parents[index] = PARENT_TERMINAL;
		this.active.push(x, y);
	}

	getLabel(x, y) {
		return this.labels[y * this.width + x];
	}

	hasCapacity(index, direction) {
		return (this.capacity[index] & (1 << (direction - 1))) > 0;
	}

	setFlow(index, direction) {
		this.capacity[index] &= ~(1 << (direction - 1));
	}

	removeFlow(index, direction) {
		this.capacity[index] |= (1 << (direction - 1));
	}

	run() {
		const width = this.width;
		const labels = this.labels;
		const active = this.active;

		const length = active.length;
		for (let i = 0; i < length; i++) {
			const x = active[i];
			const y = active[i + 1];
			const index = y * width + x;

			const label = labels[index];
			if (label === LABEL_FREE || label === LABEL_UNPATHABLE) {
				continue;
			}

			for (let direction = 1; direction <= 8; direction++) {
				const px = x + DIRECTION_TO_OFFSET[direction * 2];
				const py = y + DIRECTION_TO_OFFSET[direction * 2 + 1];
				const indexP = py * width + px;
				const labelP = labels[indexP];
				if (label === LABEL_SOURCE) {
					if (labelP !== LABEL_SOURCE && this.hasCapacity(index, direction)) {
						active.push(x, y);
						break;
					}
				} else {
					if (labelP === LABEL_FREE && this.hasCapacity(indexP, (direction + 3) % 8 + 1)) {
						active.push(x, y);
						break;
					}
				}
			}
		}
		active.splice(0, length);

		let iteration = 0;
		while (this.growth()) {
			iteration++;
			this.adoption(iteration);
		}

		return iteration; // max flow
	}

	growth() {
		const width = this.width;
		const labels = this.labels;
		const parents = this.parents;
		const active = this.active;

		while (active.length > 0) {
			const x = active[active.length - 2];
			const y = active[active.length - 1];
			const index = y * width + x;

			const label = labels[index];

			if (label === LABEL_SOURCE) {
				for (let direction = 1; direction <= 8; direction++) {
					if (!this.hasCapacity(index, direction)) {
						continue;
					}
					const px = x + DIRECTION_TO_OFFSET[direction * 2];
					const py = y + DIRECTION_TO_OFFSET[direction * 2 + 1];
					const indexP = py * width + px;
					const labelP = labels[indexP];
					if (labelP === LABEL_SINK) {
						this.setFlow(index, direction);
						this.removeFlow(indexP, (direction + 3) % 8 + 1);
						this.augmentSource(x, y);
						this.augmentSink(px, py);
						return true;
					}
					if (labelP === LABEL_FREE) {
						labels[indexP] = LABEL_SOURCE;
						active.unshift(px, py);
						parents[indexP] = (direction + 3) % 8 + 1;
					}
				}
			} else if (label === LABEL_SINK) {
				for (let direction = 1; direction <= 8; direction++) {
					const reverseDirection = (direction + 3) % 8 + 1;
					const px = x + DIRECTION_TO_OFFSET[direction * 2];
					const py = y + DIRECTION_TO_OFFSET[direction * 2 + 1];
					const indexP = py * width + px;
					if (!this.hasCapacity(indexP, reverseDirection)) {
						continue;
					}
					const labelP = labels[indexP];
					if (labelP === LABEL_SOURCE) {
						this.setFlow(indexP, reverseDirection);
						this.removeFlow(index, direction);
						this.augmentSource(px, py);
						this.augmentSink(x, y);
						return true;
					}
					if (labelP === LABEL_FREE) {
						labels[indexP] = LABEL_SINK;
						active.unshift(px, py);
						parents[indexP] = reverseDirection;
					}
				}
			}

			active.pop();
			active.pop();
		}

		return false;
	}

	augmentSource(startX, startY) {
		const width = this.width;
		const orphans = this.orphans;
		const parents = this.parents;

		let x = startX, y = startY;
		let index = y * width + x;
		let parent;
		while ((parent = parents[index]) !== PARENT_TERMINAL) {
			const px = x + DIRECTION_TO_OFFSET[parent * 2];
			const py = y + DIRECTION_TO_OFFSET[parent * 2 + 1];
			const indexP = py * width + px;
			this.setFlow(indexP, (parent + 3) % 8 + 1);
			this.removeFlow(index, parent);
			parents[index] = PARENT_NONE;
			orphans.push(x, y);
			x = px;
			y = py;
			index = indexP;
		}
	}

	augmentSink(startX, startY) {
		const width = this.width;
		const orphans = this.orphans;
		const parents = this.parents;

		let x = startX, y = startY;
		let index = y * width + x;
		let parent;
		while ((parent = parents[index]) !== PARENT_TERMINAL) {
			const px = x + DIRECTION_TO_OFFSET[parent * 2];
			const py = y + DIRECTION_TO_OFFSET[parent * 2 + 1];
			const indexP = py * width + px;
			this.setFlow(index, parent);
			this.removeFlow(indexP, (parent + 3) % 8 + 1);
			parents[index] = PARENT_NONE;
			orphans.push(x, y);
			x = px;
			y = py;
			index = indexP;
		}
	}

	adoption(iteration) {
		const width = this.width;
		const labels = this.labels;
		const orphans = this.orphans;
		const timestamps = this.timestamps;
		const parents = this.parents;
		const active = this.active;

		let orphanIndex = orphans.length - 2;
		let orphanIndex2 = 0;
		const orphans2 = [];
		const queue = [];
		while (orphanIndex >= 0 || orphanIndex2 < orphans2.length) {
			let x, y;
			if (orphanIndex2 < orphans2.length) {
				x = orphans2[orphanIndex2];
				y = orphans2[orphanIndex2 + 1];
				orphanIndex2 += 2;
			} else {
				x = orphans[orphanIndex];
				y = orphans[orphanIndex + 1];
				orphanIndex -= 2;
			}
			const index = y * width + x;

			let found = false;
			const label = labels[index];
			if (label !== LABEL_FREE) {
				for (let direction = 1; direction <= 8; direction++) {
					const px = x + DIRECTION_TO_OFFSET[direction * 2];
					const py = y + DIRECTION_TO_OFFSET[direction * 2 + 1];
					const indexP = py * width + px;
					if (labels[indexP] !== label) {
						continue;
					}
					if (
						label === LABEL_SOURCE
							? !this.hasCapacity(indexP, (direction + 3) % 8 + 1)
							: !this.hasCapacity(index, direction)
					) {
						continue;
					}
					if (this.findOrigin(px, py)) {
						timestamps[index] = iteration;
						parents[index] = direction;
						found = true;
						break;
					}
				}
			}

			if (!found) {
				labels[index] = LABEL_FREE;
				queue.push(x, y);

				for (let direction = 1; direction <= 8; direction++) {
					const px = x + DIRECTION_TO_OFFSET[direction * 2];
					const py = y + DIRECTION_TO_OFFSET[direction * 2 + 1];
					const indexP = py * width + px;
					if (
						labels[indexP] === label &&
						parents[indexP] === (direction + 3) % 8 + 1
					) {
						parents[indexP] = PARENT_NONE;
						orphans2.push(px, py);
					}
				}
			}
		}
		orphans.splice(0, orphans.length);

		for (let i = 0; i < queue.length; i += 2) {
			const x = queue[i];
			const y = queue[i + 1];

			for (let direction = 1; direction <= 8; direction++) {
				const px = x + DIRECTION_TO_OFFSET[direction * 2];
				const py = y + DIRECTION_TO_OFFSET[direction * 2 + 1];
				const indexP = py * width + px;
				const label = labels[indexP];
				if (label === LABEL_SOURCE) {
					if (this.hasCapacity(indexP, (direction + 3) % 8 + 1)) {
						active.unshift(px, py);
					}
				} else if (label === LABEL_SINK) {
					const index = y * width + x;
					if (this.hasCapacity(index, direction)) {
						active.unshift(px, py);
					}
				}
			}
		}
	}

	findOrigin(startX, startY, iteration) {
		const width = this.width;
		const parents = this.parents;
		const timestamps = this.timestamps;

		let x = startX, y = startY;
		let parent;
		let isTime = false;
		do {
			let index = y * width + x;
			if (timestamps[index] === iteration) {
				isTime = true;
				break;
			}
			parent = parents[index];
			if (parent === PARENT_NONE) {
				return false;
			}
			if (parent === PARENT_TERMINAL) {
				break;
			}
			x += DIRECTION_TO_OFFSET[parent * 2];
			y += DIRECTION_TO_OFFSET[parent * 2 + 1];
		} while (parent);

		if (isTime) {

			x = startX, y = startY;
			let index = y * width + x;
			while (timestamps[index] !== iteration) {
				timestamps[index] = iteration;
				parent = parents[index];
				x += DIRECTION_TO_OFFSET[parent * 2];
				y += DIRECTION_TO_OFFSET[parent * 2 + 1];
				index = y * width + x;
			}

		} else {

			x = startX, y = startY;
			let index = y * width + x;
			while ((parent = parents[index]) !== PARENT_TERMINAL) {
				timestamps[index] = iteration;
				x += DIRECTION_TO_OFFSET[parent * 2];
				y += DIRECTION_TO_OFFSET[parent * 2 + 1];
				index = y * width + x;
			}

			timestamps[index] = iteration;

		}

		return true;
	}

	static create(terrain, sources, options = {}) {
		const {extendSinks = 2, extendSources = 1} = options;

		const UNPATHABLE = 255;

		const sinkQueue = [];
		const data = new PathFinder.CostMatrix();
		for (let x = 0; x <= 49; x++) {
			for (let y = 0; y <= 49; y++) {
				if ((terrain.get(x, y) & TERRAIN_MASK_WALL) > 0) {
					data.setFast(x, y, UNPATHABLE);
				} else if (x === 0 || y === 0 || x === 49 || y === 49) {
					data.setFast(x, y, LABEL_SINK);
					sinkQueue.push(x, y);
				}
			}
		}

		let sourceQueue = [];
		if (typeof sources[0] === 'object') {
			for (const {x, y} of sources) {
				data.setFast(x, y, LABEL_SOURCE);
				sourceQueue.push(x, y);
			}
		} else {
			sourceQueue = sources.slice(0);
			for (let i = 0; i < sources.length; i += 2) {
				const x = sources[i];
				const y = sources[i + 1];
				data.setFast(x, y, LABEL_SOURCE);
			}
		}

		function extendRegion(queue, value, range) {
			const queue2 = [];
			const oppositeValue = (value === LABEL_SOURCE)
				? LABEL_SINK : LABEL_SOURCE;
			for (let k = 0; k < range; k++) {
				const length = queue.length;
				for (let w = 0; w < length; w += 2) {
					const x = queue[w];
					const y = queue[w + 1];
					let allowReduce = true;
					for (let direction = 1; direction <= 8; direction++) {
						const px = x + DIRECTION_TO_OFFSET[direction * 2];
						const py = y + DIRECTION_TO_OFFSET[direction * 2 + 1];
						if (px < 0 || py < 0 || px > 49 || py > 49) {
							continue;
						}
						const label = data.get(px, py);
						if (label === oppositeValue) {
							allowReduce = false;
						} else if (label === LABEL_FREE) {
							data.setFast(px, py, value);
							queue.push(px, py);
						}
					}
					if (allowReduce) {
						data.setFast(x, y, UNPATHABLE);
					} else {
						queue2.push(x, y);
					}
				}
				queue.splice(0, length);
				queue.push(...queue2);
			}
		}

		if (extendSinks > 0) {
			extendRegion(sinkQueue, LABEL_SINK, extendSinks);
		}
		if (extendSources > 0) {
			extendRegion(sourceQueue, LABEL_SOURCE, extendSources);
		}

		return new MinCut(
			(x, y) => data.get(x, y) !== UNPATHABLE,
			50, 50, sourceQueue, sinkQueue
		);
	}

}
module.exports = MinCut;

// comment this line to disable registering MinCut class globally
global.MinCut = MinCut;

global.MINCUT_FREE = LABEL_FREE;
global.MINCUT_SOURCE = LABEL_SOURCE;
global.MINCUT_SINK = LABEL_SINK;
global.MINCUT_UNPATHABLE = LABEL_UNPATHABLE;
