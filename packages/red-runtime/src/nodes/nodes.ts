import {
  Context,
  $
} from '../context'

import {
  NodesRegistry
} from './registry'

export {
  NodesRegistry
}

import {
  Serializer
} from './serialize'

const { log } = console

import {
  ISerializer,
  Node,
  Link,
  Subflow,
  NodeDef,
  Flow
} from './interfaces'

/**
 * A set of Nodes that form a subflow or similar grouping
 */
export class Nodes extends Context {
  public registry = new NodesRegistry()
  public configNodes = {
    users: {}
  }
  protected _dirty: boolean = false
  public serializer: ISerializer
  public nodes = []
  public links = []
  public workspaces = {}
  public workspacesOrder = []
  public subflows = {}
  public n = null // {}
  public initialLoad = null // {}
  public loadedFlowVersion: string
  public defaultWorkspace = {}

  public setNodeList: Function
  public getNodeSet: Function
  public addNodeSet: Function
  public removeNodeSet: Function
  public enableNodeSet: Function
  public disableNodeSet: Function
  public registerType: Function
  public getType: Function

  constructor() {
    super()

    // TODO: use injectable instead!
    this.serializer = new Serializer(this)

    const {
      RED,
      registry,
      configNodes,
      nodes,
    } = this

    const {
      convertNode,
      importNodes
    } = this.rebind([
        'convertNode',
        'importNodes'
      ])

    this._validateObj(RED.events, 'RED.events', 'Nodes constructor')

    RED.events.on("registry:node-type-added", function (type: string) {
      var def = registry.getNodeType(type);
      var replaced = false;
      var replaceNodes = [];

      this._validateObj(RED.nodes, 'RED.nodes', 'Nodes events.on handler')

      RED.nodes.eachNode(function (n: Node) {
        if (n.type === "unknown" && n.name === type) {
          replaceNodes.push(n);
        }
      });
      RED.nodes.eachConfig(function (n: Node) {
        if (n.type === "unknown" && n.name === type) {
          replaceNodes.push(n);
        }
      });

      if (replaceNodes.length > 0) {
        var reimportList = [];
        replaceNodes.forEach(function (n: Node) {
          if (configNodes.hasOwnProperty(n.id)) {
            delete configNodes[n.id];
          } else {
            nodes.splice(nodes.indexOf(n), 1);
          }
          reimportList.push(convertNode(n));
        });
        RED.view.redraw(true);
        var result = importNodes(reimportList, false);
        var newNodeMap = {};
        result[0].forEach(function (n: Node) {
          newNodeMap[n.id] = n;
        });
        RED.nodes.eachLink(function (l: Link) {
          if (newNodeMap.hasOwnProperty(l.source.id)) {
            l.source = newNodeMap[l.source.id];
          }
          if (newNodeMap.hasOwnProperty(l.target.id)) {
            l.target = newNodeMap[l.target.id];
          }
        });
        RED.view.redraw(true);
      }
    });
  }

  configDelegates() {
    const {
      registry
    } = this

    this.setNodeList = registry.setNodeList
    this.getNodeSet = registry.getNodeSet
    this.addNodeSet = registry.addNodeSet
    this.removeNodeSet = registry.removeNodeSet
    this.enableNodeSet = registry.enableNodeSet
    this.disableNodeSet = registry.disableNodeSet
    this.registerType = registry.registerNodeType
    this.getType = registry.getNodeType
  }

  getID() {
    return (1 + Math.random() * 4294967295).toString(16);
  }

  addNode(n: Node) {
    const {
      RED
    } = this

    this._validateNode(n, 'n', 'addNode')
    this._validateNodeDef(n._def, 'n._def', 'addNode')

    if (n.type.indexOf("subflow") !== 0) {
      n["_"] = n._def._;
    } else {
      n["_"] = RED._;
    }
    if (n._def.category == "config") {
      this.configNodes[n.id] = n;
    } else {
      n.ports = [];
      if (n.wires && (n.wires.length > n.outputs)) {
        n.outputs = n.wires.length;
      }
      if (n.outputs) {
        for (var i = 0; i < n.outputs; i++) {
          n.ports.push(i);
        }
      }
      n.dirty = true;
      this.updateConfigNodeUsers(n);
      if (n._def.category == "subflows" && typeof n.i === "undefined") {
        var nextId = 0;
        RED.nodes.eachNode(function (node: Node) {
          nextId = Math.max(nextId, node.i || 0);
        });
        n.i = nextId + 1;
      }
      this.nodes.push(n);
    }
    RED.events.emit('nodes:add', n);
    return this
  }

  addLink(link: Link) {
    this._validateLink(link, 'link', 'addLink')
    this.links.push(link);
  }
  /**
   * Find and return a node by ID
   * @param id {string} id of node to find
   */
  getNode(id: string) {
    if (id in this.configNodes) {
      return this.configNodes[id];
    } else {
      for (var n in this.nodes) {
        if (this.nodes[n].id == id) {
          return this.nodes[n];
        }
      }
    }
    return null;
  }

  /**
   * Remove a node from the canvas by ID
   * @param id {string} id of node to remove
   */
  removeNode(id: string) {
    const {
      RED,
      configNodes,
      nodes,
      links,
      registry,
      n
    } = this

    const {
      getNode,
      removeNode
    } = this.rebind([
        'getNode',
        'removeNode'
      ])

    this._validateStr(id, 'id', 'removeNode')

    var removedLinks = [];
    var removedNodes = [];
    var node;
    if (id in configNodes) {
      node = configNodes[id];
      delete configNodes[id];
      RED.events.emit('nodes:remove', node);
      RED.workspaces.refresh();
    } else {
      node = getNode(id);
      if (!node) {
        this.logWarning(`node ${id} to remove not found in node collection`, {
          id,
          nodes: this.nodes
        })
        return {}
      }
      nodes.splice(nodes.indexOf(node), 1);
      removedLinks = links.filter(function (l) {
        return (l.source === node) || (l.target === node);
      });
      removedLinks.forEach(function (l) {
        links.splice(links.indexOf(l), 1);
      });
      var updatedConfigNode = false;
      for (var d in node._def.defaults) {
        if (node._def.defaults.hasOwnProperty(d)) {
          var property = node._def.defaults[d];
          if (property.type) {
            var type = registry.getNodeType(property.type);
            if (type && type.category == "config") {
              var configNode = configNodes[node[d]];
              if (configNode) {
                updatedConfigNode = true;
                if (configNode._def.exclusive) {
                  removeNode(node[d]);
                  removedNodes.push(configNode);
                } else {
                  var users = configNode.users;
                  users.splice(users.indexOf(node), 1);
                }
              }
            }
          }
        }
      }
      if (updatedConfigNode) {
        RED.workspaces.refresh();
      }
      RED.events.emit('nodes:remove', node);
    }
    if (node && node._def.onremove) {
      node._def.onremove.call(n);
    }
    return {
      links: removedLinks,
      nodes: removedNodes
    };
  }

  /**
   * Remove a link
   * @param l {string} link to remove
   */
  removeLink(l: Link) {
    const { links } = this
    var index = links.indexOf(l);
    if (index != -1) {
      links.splice(index, 1);
    }
  }

  addWorkspace(ws) {
    const {
      RED,
      workspaces,
      workspacesOrder
    } = this

    workspaces[ws.id] = ws;
    ws._def = RED.nodes.getType('tab');
    workspacesOrder.push(ws.id);
  }

  getWorkspace(id) {
    const {
      workspaces,
    } = this

    return workspaces[id];
  }

  removeWorkspace(id) {
    const {
      RED,
      nodes,
      configNodes,
      workspacesOrder,
    } = this

    const {
      removeNode
    } = this.rebind([
        'removeNode'
      ])

    delete this.workspaces[id];
    this.workspacesOrder.splice(workspacesOrder.indexOf(id), 1);

    // TODO: Fix - instance vars?
    var removedNodes = [];
    var removedLinks = [];
    var n;
    var node;

    for (n = 0; n < nodes.length; n++) {
      node = nodes[n];
      if (node.z == id) {
        removedNodes.push(node);
      }
    }
    for (n in configNodes) {
      if (configNodes.hasOwnProperty(n)) {
        node = configNodes[n];
        if (node.z == id) {
          removedNodes.push(node);
        }
      }
    }
    for (n = 0; n < removedNodes.length; n++) {
      var result = removeNode(removedNodes[n].id);
      removedLinks = removedLinks.concat(result.links);
    }
    return {
      nodes: removedNodes,
      links: removedLinks
    };
  }

  addSubflow(sf: Subflow, createNewIds: boolean) {
    const {
      RED,
      subflows
    } = this

    this._validateNode(sf, 'sf', 'addSubflow')

    if (createNewIds) {
      var subflowNames = Object.keys(subflows).map(function (sfid: string) {
        return subflows[sfid].name;
      });

      subflowNames.sort();
      var copyNumber = 1;
      var subflowName = sf.name;
      subflowNames.forEach(function (name: string) {
        if (subflowName == name) {
          copyNumber++;
          subflowName = sf.name + " (" + copyNumber + ")";
        }
      });
      sf.name = subflowName;
    }
    subflows[sf.id] = sf;
    RED.nodes.registerType("subflow:" + sf.id, {
      defaults: {
        name: {
          value: ""
        }
      },
      info: sf.info,
      icon: "subflow.png",
      category: "subflows",
      inputs: sf.in.length,
      outputs: sf.out.length,
      color: "#da9",
      label: function () {
        return this.name || RED.nodes.subflow(sf.id).name
      },
      labelStyle: function () {
        return this.name ? "node_label_italic" : "";
      },
      paletteLabel: function () {
        return RED.nodes.subflow(sf.id).name
      },
      inputLabels: function (i: number) {
        return sf.inputLabels ? sf.inputLabels[i] : null
      },
      outputLabels: function (i: number) {
        return sf.outputLabels ? sf.outputLabels[i] : null
      },
      set: {
        module: "node-red"
      }
    });
    sf._def = RED.nodes.getType("subflow:" + sf.id);
  }

  getSubflow(id) {
    const { subflows } = this
    return subflows[id];
  }

  removeSubflow(sf: string | Subflow) {
    const { subflows, registry } = this

    const id: string = typeof sf === 'string' ? sf : sf.id

    delete this.subflows[id];
    registry.removeNodeType("subflow:" + id);
  }

  // TODO: split up function into smaller parts to make easier to track and test internals
  subflowContains(sfid: string, nodeid: string) {
    this._validateStr(sfid, 'sfid', 'subflowContains')
    this._validateStr(nodeid, 'nodeid', 'subflowContains')

    const { nodes } = this
    const {
      subflowContains
    } = this.rebind([
        'subflowContains'
      ])

    log('subflowContains', {
      nodes,
      sfid,
      nodeid
    })

    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (node.z === sfid) {
        // https://developer.mozilla.org/th/docs/Web/JavaScript/Reference/Global_Objects/RegExp/exec
        var m = /^subflow:(.+)$/.exec(node.type);
        log('match', {
          type: node.type,
          m
        })
        if (m) {
          log('node matching on ^subflow:(.+)$', {
            m,
            type: node.type,
          })
          if (m[1] === nodeid) {
            return true;
          } else {
            log('recurse node matching', {
              m1: m[1],
              nodeid
            })
            var result = subflowContains(m[1], nodeid);
            if (result) {
              return true;
            }
          }
        } else {
          log('node not matching on ^subflow:(.+)$', {
            m,
            type: node.type,
          })
        }
      } else {
        log('node not matching on .z', {
          sfid,
          z: node.z,
        })
      }
    }
    return false;
  }

  /**
   * Get all the flow nodes related to a node
   * @param node { Node } the node to find all flow nodes from
   */
  getAllFlowNodes(node: Node) {
    const {
      links
    } = this

    this._validateNode(node, 'node', 'getAllFlowNodes')

    var visited = {};
    visited[node.id] = true;
    var nns = [node];
    var stack = [node];
    while (stack.length !== 0) {
      var n = stack.shift();
      var childLinks = links.filter(function (d) {
        return (d.source === n) || (d.target === n);
      });
      for (var i = 0; i < childLinks.length; i++) {
        var child = (childLinks[i].source === n) ? childLinks[i].target : childLinks[i].source;
        var id = child.id;
        if (!id) {
          id = child.direction + ":" + child.i;
        }
        if (!visited[id]) {
          visited[id] = true;
          nns.push(child);
          stack.push(child);
        }
      }
    }
    return nns;
  }

  /**
   * Convert a node to a workspace?
   * @param n { Node } the node to convert
   */
  convertWorkspace(n: Node) {
    var node = {
      id: null,
      type: null
    };

    node.id = n.id;
    node.type = n.type;
    for (var d in n._def.defaults) {
      if (n._def.defaults.hasOwnProperty(d)) {
        node[d] = n[d];
      }
    }
    return node;
  }
  /**
   * Converts a node to an exportable JSON Object
   * @param n { Node } the node to convert
   * @param exportCreds { boolean } if node (user) credentials should also be exported
   **/
  convertNode(n: Node, exportCreds: boolean) {
    const {
      links
    } = this

    this._validateNode(n, 'n', 'convertNode')
    this._validateNodeDef(n._def, 'n._def', 'convertNode')

    if (n.type === 'tab') {
      return this.convertWorkspace(n);
    }
    exportCreds = exportCreds || false;

    // TODO: use interface or type instead!
    var node = {
      id: null,
      type: null,
      x: null,
      y: null,
      z: null,
      wires: null,
      credentials: null,
      inputLabels: null,
      outputLabels: null
    };

    node.id = n.id;
    node.type = n.type;
    node.z = n.z;

    if (node.type == "unknown") {
      for (var p in n._orig) {
        if (n._orig.hasOwnProperty(p)) {
          node[p] = n._orig[p];
        }
      }
    } else {
      for (var d in n._def.defaults) {
        if (n._def.defaults.hasOwnProperty(d)) {
          node[d] = n[d];
        }
      }
      if (exportCreds && n.credentials) {
        var credentialSet = {};
        node.credentials = {};
        for (var cred in n._def.credentials) {
          if (n._def.credentials.hasOwnProperty(cred)) {
            if (n._def.credentials[cred].type == 'password') {
              if (!n.credentials._ ||
                n.credentials["has_" + cred] != n.credentials._["has_" + cred] ||
                (n.credentials["has_" + cred] && n.credentials[cred])) {
                credentialSet[cred] = n.credentials[cred];
              }
            } else if (n.credentials[cred] != null && (!n.credentials._ || n.credentials[cred] != n.credentials._[cred])) {
              credentialSet[cred] = n.credentials[cred];
            }
          }
        }
        if (Object.keys(credentialSet).length > 0) {
          node.credentials = credentialSet;
        }
      }
    }
    if (n._def.category != "config") {
      node.x = n.x;
      node.y = n.y;
      node.wires = [];
      for (var i = 0; i < n.outputs; i++) {
        node.wires.push([]);
      }
      var wires = links.filter(function (d: Link) {
        return d.source === n;
      });
      for (var j = 0; j < wires.length; j++) {
        var w = wires[j];
        if (w.target.type != "subflow") {
          node.wires[w.sourcePort].push(w.target.id);
        }
      }

      if (n.inputs > 0 && n.inputLabels && !/^\s*$/.test(n.inputLabels.join(""))) {
        node.inputLabels = n.inputLabels.slice();
      }
      if (n.outputs > 0 && n.outputLabels && !/^\s*$/.test(n.outputLabels.join(""))) {
        node.outputLabels = n.outputLabels.slice();
      }
    }
    return node;
  }

  /**
   * Convert a node to a Subflow
   * @param n { Node } node to convert
   */
  convertSubflow(n: Node) {
    this._validateNode(n, 'n', 'convertSubflow')

    var node: any = {
    };
    node.id = n.id;
    node.type = n.type;
    node.name = n.name;
    node.info = n.info;
    node.in = [];
    node.out = [];

    this._validateArray(n.in, 'n.in', 'convertSubflow')
    this._validateArray(n.out, 'n.out', 'convertSubflow')

    n.in.forEach((p) => {
      var nIn = {
        x: p.x,
        y: p.y,
        wires: []
      };
      var wires = this.links.filter((d) => {
        return d.source === p
      });
      for (var i = 0; i < wires.length; i++) {
        var w = wires[i];
        if (w.target.type != "subflow") {
          nIn.wires.push({
            id: w.target.id
          })
        }
      }
      node.in.push(nIn);
    });
    n.out.forEach((p, c) => {
      var nOut = {
        x: p.x,
        y: p.y,
        wires: []
      };
      var wires = this.links.filter(function (d: Link) {
        return d.target === p
      });
      for (var i = 0; i < wires.length; i++) {
        if (wires[i].source.type != "subflow") {
          nOut.wires.push({
            id: wires[i].source.id,
            port: wires[i].sourcePort
          })
        } else {
          nOut.wires.push({
            id: n.id,
            port: 0
          })
        }
      }
      node.out.push(nOut);
    });

    if (node.in.length > 0 && n.inputLabels && !/^\s*$/.test(n.inputLabels.join(""))) {
      node.inputLabels = n.inputLabels.slice();
    }
    if (node.out.length > 0 && n.outputLabels && !/^\s*$/.test(n.outputLabels.join(""))) {
      node.outputLabels = n.outputLabels.slice();
    }


    return node;
  }

  /**
   * Converts the current node selection to an exportable JSON Object
   * @param set { Node[] } set of nodes to export
   * @param exportedSubflows { object } map of subflows by ID to be exported
   * @param exportedConfigNodes { object } map of config nodes by ID to be exported
   */
  createExportableNodeSet(set: Node[], exportedSubflows: object, exportedConfigNodes: object) {
    return this.serializer.createExportableNodeSet(set, exportedSubflows, exportedConfigNodes)
  }

  /**
   * Create a complete node set for export
   * @param exportCredentials { boolean } whether credentials should also be exported
   */
  createCompleteNodeSet(exportCredentials: boolean) {
    return this.serializer.createCompleteNodeSet(exportCredentials)
  }

  /**
   * Check if a subflow has a node that matches a given node
   * @param subflow { Node } node subflow
   * @param subflowNodes list of subflow nodes
   */
  checkForMatchingSubflow(subflow: Node, subflowNodes: Node[]) {
    const {
      RED
    } = this
    const {
      createExportableNodeSet
    } = this.rebind([
        'createExportableNodeSet'
      ])

    this._validateNode(subflow, 'subflow', 'checkForMatchingSubflow')
    this._validateArray(subflowNodes, 'subflowNodes', 'checkForMatchingSubflow')

    var i;
    var match = null;
    try {
      RED.nodes.eachSubflow((sf) => {
        this._validateNode(sf, 'sf', 'checkForMatchingSubflow', 'iterate subflow nodes')

        log('eachSubflow', {
          sf
        })

        if (sf.name != subflow.name ||
          sf.info != subflow.info ||
          sf.in.length != subflow.in.length ||
          sf.out.length != subflow.out.length) {
          return;
        }
        var sfNodes = RED.nodes.filterNodes({
          z: sf.id
        });

        const compareLengths = {
          sfNodes: sfNodes.length,
          subflowNodes: subflowNodes.length
        }

        log('original node sets', {
          sfNodes,
          subflowNodes,
          compareLengths
        })

        if (sfNodes.length != subflowNodes.length) {
          log('no match: incompatible lengths', {
            compareLengths
          })
          return;
        }

        var subflowNodeSet = [subflow].concat(subflowNodes);
        var sfNodeSet = [sf].concat(sfNodes);

        log('after concat', {
          subflowNodeSet,
          sfNodeSet,
          DEFsubflowNodeSet: subflowNodeSet.map(n => n._def),
          DEFsfNodeSet: sfNodeSet.map(n => n._def)
        })

        var exportableSubflowNodes = JSON.stringify(subflowNodeSet);

        // Seems to cut off the credentials!
        // Test if this is current intended behavior, then make sure test runs without credentials?
        const exportableSFNodeSet = createExportableNodeSet(sfNodeSet)
        log({
          exportableSFNodeSet
        })

        var exportableSFNodes = JSON.stringify(exportableSFNodeSet);
        var nodeMap = {};

        for (i = 0; i < sfNodes.length; i++) {
          exportableSubflowNodes = exportableSubflowNodes.replace(new RegExp("\"" + subflowNodes[i].id + "\"", "g"), '"' + sfNodes[i].id + '"');
        }
        exportableSubflowNodes = exportableSubflowNodes.replace(new RegExp("\"" + subflow.id + "\"", "g"), '"' + sf.id + '"');

        const exportableSubflowNodesObj = JSON.parse(exportableSubflowNodes)
        const exportableSFNodesObj = JSON.parse(exportableSFNodes)

        // TODO: avoid string compare, too fragile!
        log('compare', {
          exportableSubflowNodesObj,
          exportableSFNodesObj
        })

        const nodesMatch = exportableSubflowNodesObj.every((sfNode, index) => {
          return this._isEquivalent(sfNode, exportableSFNodesObj[index])
        })

        if (!nodesMatch) {
          log('no match: not equivalent', {
            exportableSubflowNodesObj,
            exportableSFNodesObj
          })
          return;
        }
        log('found match', {
          sf
        })

        match = sf;
        throw new Error();
      });
    } catch (err) {
      console.log(err.stack);
    }
    return match;
  }

  /**
   * Compare if nodes match (equality)
   * @param nodeA node to to compare
   * @param nodeB { Node } node to compare with
   * @param idMustMatch { boolean } if IDs must match as well to be truly equal
   */
  compareNodes(nodeA: Node, nodeB: Node, idMustMatch: boolean) {
    if (idMustMatch && nodeA.id != nodeB.id) {
      return false;
    }
    if (nodeA.type != nodeB.type) {
      return false;
    }
    var def = nodeA._def;
    for (var d in def.defaults) {
      if (def.defaults.hasOwnProperty(d)) {
        var vA = nodeA[d];
        var vB = nodeB[d];
        if (typeof vA !== typeof vB) {
          return false;
        }
        if (vA === null || typeof vA === "string" || typeof vA === "number") {
          if (vA !== vB) {
            return false;
          }
        } else {
          if (JSON.stringify(vA) !== JSON.stringify(vB)) {
            return false;
          }
        }
      }
    }
    return true;
  }

  /**
   * Import nodes from a string (JSON serialization) reprepresentation
   * @param newNodesObj { Node } the node definitions to import
   * @param createNewIds { boolean } create IDs of imported nodes if not in import definitions
   * @param createMissingWorkspace { boolean } create missing workspace if no such workspace exists
   */
  importNodes(newNodesObj: string, createNewIds: boolean, createMissingWorkspace: boolean) {
    return this.serializer.importNodes(newNodesObj, createNewIds, createMissingWorkspace)
  }

  // TODO: supports filter.z|type
  /**
   * Filter nodes based on a filter criteria
   * @param filter { object } filter criteria (Node) all filtered nodes must match
   */
  filterNodes(filter: Node) {
    const {
      nodes
    } = this

    var result = [];

    for (var n = 0; n < nodes.length; n++) {
      var node = nodes[n];

      this._validateNode(node, 'node', 'filterNodes', 'iterate nodes')

      if (filter.hasOwnProperty("z") && node.z !== filter.z) {
        continue;
      }
      if (filter.hasOwnProperty("type") && node.type !== filter.type) {
        continue;
      }
      result.push(node);
    }
    return result;
  }

  filterLinks(filter: Link) {
    const {
      links
    } = this

    var result = [];

    for (var n = 0; n < links.length; n++) {
      var link = links[n];

      this._validateLink(link, 'link', 'filterNodes', { links })

      if (filter.source) {
        if (filter.source.hasOwnProperty("id") && link.source.id !== filter.source.id) {
          continue;
        }
        if (filter.source.hasOwnProperty("z") && link.source.z !== filter.source.z) {
          continue;
        }
      }
      if (filter.target) {
        if (filter.target.hasOwnProperty("id") && link.target.id !== filter.target.id) {
          continue;
        }
        if (filter.target.hasOwnProperty("z") && link.target.z !== filter.target.z) {
          continue;
        }
      }
      if (filter.hasOwnProperty("sourcePort") && link.sourcePort !== filter.sourcePort) {
        continue;
      }
      result.push(link);
    }
    return result;
  }

  // Update any config nodes referenced by the provided node to ensure their 'users' list is correct
  /**
   * Update configured users with the user of a given node
   * @param n { Node } update config users of node
   */
  updateConfigNodeUsers(n: Node) {
    const {
      registry,
      configNodes
    } = this

    this._validateNode(n, 'n', 'updateConfigNodeUsers')
    this._validateNodeDef(n._def, 'n._def', 'updateConfigNodeUsers')

    const keys = Object.keys(n._def.defaults)
    if (keys.length === 0) {
      this.logWarning('no defaults registered for node def', {
        _def: n._def,
        n
      })
    }

    for (var d in n._def.defaults) {
      if (n._def.defaults.hasOwnProperty(d)) {
        log({
          d,
          n,
          _def: n._def,
          defaults: n._def.defaults,
        })

        var property = n._def.defaults[d];

        if (property.type) {
          var type = registry.getNodeType(property.type);
          log('type property', {
            type,
            property
          })

          if (type && type.category == "config") {
            var defPropId = n[d]
            if (defPropId) {
              var configNode = configNodes[defPropId];
              if (configNode) {
                if (configNode.users.indexOf(n) === -1) {
                  configNode.users.push(n);
                } else {
                  this.logWarning('user already registered in configNode.users', {
                    n,
                    users: configNode.users
                  })
                }
              } else {
                this.logWarning('missing configNode')
              }
            } else {
              this.logWarning(`missing default property: ${defPropId} in configNodes`, {
                n,
                d,
                configNodes,
                defPropId
              })
            }
          } else {
            this.logWarning('node type not a config category', {
              category: type.category,
              property
            })
          }
        } else {
          this.logWarning('missing property type', {
            property
          })
        }
      }
    }
  }

  /**
   * Return the flow version
   * @param version { string } version of flow
   */
  flowVersion(version) {
    let {
      loadedFlowVersion
    } = this

    if (version !== undefined) {
      loadedFlowVersion = version;
    }
    this.setInstanceVars({ loadedFlowVersion })
    return loadedFlowVersion;
  }

  /**
   * Clear all the node flows
   */
  clear() {
    let {
      RED,
      defaultWorkspace,
      subflows,
      workspaces
    } = this

    var subflowIds = Object.keys(subflows);
    subflowIds.forEach((id) => {
      RED.subflow.removeSubflow(id)
    });
    var workspaceIds = Object.keys(workspaces);
    workspaceIds.forEach((id) => {
      RED.workspaces.remove(workspaces[id]);
    });

    defaultWorkspace = null;

    RED.nodes.dirty(true);

    RED.view.redraw(true);
    RED.palette.refresh();
    RED.workspaces.refresh();
    RED.sidebar.config.refresh();

    var node_defs = {};
    var nodes = [];
    var configNodes = {};
    var links = [];
    workspaces = {};
    var workspacesOrder = [];
    subflows = {};
    var loadedFlowVersion = null;

    this.setInstanceVars({
      node_defs,
      nodes,
      configNodes,
      links,
      workspaces,
      workspacesOrder,
      subflows,
      loadedFlowVersion
    })

    return this
  }

  /**
   * Get the current workspace order
   */
  getWorkspaceOrder() {
    return this.workspacesOrder
  }

  /**
   * Set the workspace order
   * @param order { Workspace[] } list of workspaces in a given order
   */
  setWorkspaceOrder(order: any[]) {
    this._validateArray(order, 'order', 'setWorkspaceOrder')
    this.workspacesOrder = order;
    return this
  }

  /**
   * Iterate all nodes
   * @param cb { function } For each iterated node, call this callback function
   */
  eachNode(cb) {
    for (var n = 0; n < this.nodes.length; n++) {
      cb(this.nodes[n]);
    }
  }

  /**
   * Iterate all links
   * @param cb { function } For each iterated link, call this callback function
   */
  eachLink(cb) {
    for (var l = 0; l < this.links.length; l++) {
      cb(this.links[l]);
    }
  }

  /**
   * Iterate all config nodes
   * @param cb { function } For each iterated config node, call this callback function
   */
  eachConfig(cb) {
    for (var id in this.configNodes) {
      if (this.configNodes.hasOwnProperty(id)) {
        cb(this.configNodes[id]);
      }
    }
  }

  /**
   * Iterate all subflows
   * @param cb { function } For each iterated subflow, call this callback function
   */
  eachSubflow(cb) {
    for (var id in this.subflows) {
      if (this.subflows.hasOwnProperty(id)) {
        cb(this.subflows[id]);
      }
    }
  }
  /**
   * Iterate all workspaces
   * @param cb { function } For each iterated workspace, call this callback function
   */
  eachWorkspace(cb) {
    for (var i = 0; i < this.workspacesOrder.length; i++) {
      cb(this.workspaces[this.workspacesOrder[i]]);
    }
  }

  /**
   * Return the original flow definition
   * @param flow { Flow } the flow
   */
  originalFlow(flow: Flow) {
    let {
      initialLoad
    } = this
    if (flow === undefined) {
      return initialLoad;
    } else {
      initialLoad = flow;
    }
  }

  setDirty(d: boolean) {
    this._dirty = d
  }

  /**
   * Return (or set) Nodes dirty state
   * @param d { boolean } set dirty state
   */
  dirty(d: boolean) {
    const {
      setDirty,
    } = this.rebind([
        'setDirty'
      ])

    if (d == null) {
      return this._dirty;
    } else {
      setDirty(d);
    }
  }
}