// A topological interaction graph, not surveyed positions or video registration.
export function createNavigation(sections, connections) {
  const nodes = [], edges = [];
  for (const section of sections) {
    nodes.push({ id: `c${section.id}`, sectionId: section.id, kind: 'corridor', label: `${section.titleZh} · 走廊观察点` });
    // Section 05 is already a corridor view, not an additional enclosed room.
    if (section.kind !== 'corridor' && section.photos?.length) {
      nodes.push({ id: `r${section.id}`, sectionId: section.id, kind: 'room', label: `${section.titleZh} · 室内观察点` });
      edges.push({ from: `c${section.id}`, to: `r${section.id}`, kind: 'entry', bidirectional: true, confidence: 'schematic-entry' });
    }
  }
  for (const connection of connections) {
    edges.push({ from: `c${connection.from}`, to: `c${connection.to}`, kind: 'corridor', bidirectional: true, confidence: connection.confidence });
  }
  return { nodes, edges, registration: 'schematic-pending-video' };
}

export function exitsAt(graph, nodeId, direction = 1) {
  const node = graph.nodes.find(item => item.id === nodeId);
  if (!node) return [];
  return graph.edges.flatMap(edge => {
    const outward = edge.from === nodeId;
    if (!outward && (edge.to !== nodeId || !edge.bidirectional)) return [];
    const target = outward ? edge.to : edge.from;
    const action = edge.kind === 'entry' ? (node.kind === 'room' ? 'exit' : 'enter') :
      (outward === (direction > 0) ? 'forward' : 'back');
    return [{ action, target, confidence: edge.confidence }];
  });
}

export function nextNode(graph, nodeId, action, direction = 1) {
  const exits = exitsAt(graph, nodeId, direction);
  // Back from inside a room means returning through its own entrance.
  return exits.find(exit => exit.action === action || (action === 'back' && exit.action === 'exit'))?.target || null;
}
