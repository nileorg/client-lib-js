const EventEmitter = require('events')

module.exports = class Client extends EventEmitter{
	constructor(ws, ipfs, ipfs_hash) {
		super()	
		this.ws = ws
		this.ipfs = ipfs
		this.ipfs_hash = ipfs_hash
		this.loadListeners()
		this.init()
	}
	init() {
		let nodeListString = ''
		this.ipfs.files.get(this.ipfs_hash, (err, files) => {
			files.forEach(file => { nodeListString += file.content.toString() })
			this.nodeList = JSON.parse(nodeListString)
			this.ws.emit("client.to.instance", { action: "updateNodeList" })
			this.emit("initialized")
		})
	}
	loadListeners() {
		this.ws.on("instance.to.client", data => this.processInstanceRequest(data))
		this.ws.on("node.to.client", data => this.processNodeRequest(data))
	}
	processInstanceRequest(request) {
		if (request.action === "updateOnlineNodes") {
			let onlineNodes = request.parameters.onlineNodes
			let onlineNodesIds = onlineNodes.map(function (row) {
				return row['node_id'];
			});
			this.nodeListOnline = this.nodeList.map((v) => {
				let onlineNodesIndex = onlineNodesIds.indexOf(v.node_id)
				if (onlineNodesIndex >= 0) {
					v.online = true
					v.ws_id = onlineNodes[onlineNodesIndex].ws_id
				} else {
					v.online = false
				}
				return v
			})
			this.emit("nodeListUpdated", {
				nodeList: this.nodeListOnline
			})
		}
	}
	processNodeRequest(request) {
		this.nodeListOnline = this.nodeListOnline.map((v) => {
			if(request.sender === v.ws_id) {
				if(request.content._key) {
					if(v.data){
						v.data[request.content._key] = request.content._data
					}
				}
			}
			return v
		})
		this.emit("nodeListUpdated", {
			nodeList: this.nodeListOnline
		})
		this.emit("response", request)
	}
	loadNode(node_id) {
		let node = this.nodeList.find(node => node.node_id === node_id)
		let nodeString = ''
		this.ipfs.files.get(node.ipfs_hash, (err, files) => {
			files.forEach(file => { nodeString += file.content.toString() })
			let nodeProperties = JSON.parse(nodeString)
			node.components = nodeProperties.components
			node.data = {}
			node.components.forEach(v => {
				if(v.key) {
					node.data[v.key] = null
				}
			})
			this.ws.emit("client.to.instance", { action: "updateNodeList" })
			this.emit("nodeListUpdated", {
				nodeList: this.nodeListOnline
			})
		})
	}
	call(recipient, action, parameters) {
		this.ws.emit("client.to.instance", {
			action: "forward",
			recipient: recipient,
			parameters: {
				action: action,
				parameters: parameters
			}
		})
	}
}