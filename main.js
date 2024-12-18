var app = new Vue({
    el: '#app',
    // storing the state of the page
    data: {
        // ROS connection
        ros: null,
        rosbridge_address: '',
        connected: false,
        // dragging data
        dragging: false,
        x: 'no',
        y: 'no',
        dragCircleStyle: {
            margin: '0px',
            top: '0px',
            left: '0px',
            display: 'none',
            width: '75px',
            height: '75px',
        },
        dragZone: {
            height: 0,
            width: 0,
        },
        // joystick valules
        joystick: {
            vertical: 0,
            horizontal: 0,
        },
        // publisher
        pubInterval: null,
        // 3D stuff
        viewer: null,
        tfClient: null,
        urdfClient: null,
        // map
        mapViewer: null,
        mapGridClient: null,
        interval: null,
        goal: null,
        action: {
            goal: { position: {x: 0, y: 0, z: 0} },
            feedback: { position: {x: 0, y: 0, z: 0}, state: 'idle' },
            result: { success: false },
            status: { status: 0, text: '' },
        },
        // etc
        logs: [],
        loading: false,
        port: '9090',
    },
    methods: {
        // helper methods to connect to ROS
        connect: function() {
            this.cameraContainer = document.getElementById('divCamera')
            this.mapContainer = document.getElementById('map')
            this.viewerContainer = document.getElementById('div3DViewer')

            this.loading = true
            this.ros = new ROSLIB.Ros({
                url: this.rosbridge_address
            })
            this.ros.on('connection', () => {
                this.logs.unshift((new Date()).toTimeString() + ' - Connected!')
                this.connected = true
                this.loading = false
                this.pubInterval = setInterval(this.publish, 100)
                this.setCamera()
                this.setup3DViewer()
                this.setupMapViewer()
            })
            this.ros.on('error', (error) => {
                this.logs.unshift((new Date()).toTimeString() + ` - Error: ${error}`)
            })
            this.ros.on('close', () => {
                this.logs.unshift((new Date()).toTimeString() + ' - Disconnected!')
                this.connected = false
                this.loading = false
                clearInterval(this.pubInterval)
                document.getElementById('divCamera').innerHTML = ''
                this.unset3DViewer()
                document.getElementById('map').innerHTML = ''
            })

            window.addEventListener('resize', () => {
                this.resizeViews();
            });
        },
        disconnect: function() {
            this.ros.close()
        },
        // dragging methods
        publish: function() {
            let topic = new ROSLIB.Topic({
                ros: this.ros,
                name: '/cmd_vel',
                messageType: 'geometry_msgs/Twist'
            })
            let message = new ROSLIB.Message({
                linear: { x: this.joystick.vertical, y: 0, z: 0, },
                angular: { x: 0, y: 0, z: -this.joystick.horizontal, },
            })
            topic.publish(message)
        },
        startDrag() {
            this.dragging = true
            this.x = this.y = 0
        },
        stopDrag() {
            this.dragging = false
            this.x = this.y = 'no'
            this.dragCircleStyle.display = 'none'
            this.resetJoystickVals()
        },
        doDrag(event) {
            if (this.dragging) {
                this.x = event.offsetX
                this.y = event.offsetY
                let ref = document.getElementById('dragstartzone')
                this.dragCircleStyle.display = 'inline-block'

                this.dragZone.width = ref.offsetWidth;
                this.dragZone.height = ref.offsetHeight;
                let minTop = ref.offsetTop - parseInt(this.dragCircleStyle.height) / 2
                let maxTop = minTop + this.dragZone.height;
                let top = this.y + minTop
                this.dragCircleStyle.top = `${top}px`

                let minLeft = ref.offsetLeft - parseInt(this.dragCircleStyle.width) / 2
                let maxLeft = minLeft + this.dragZone.width;
                let left = this.x + minLeft
                this.dragCircleStyle.left = `${left}px`

                this.setJoystickVals()
            }
        },
        setJoystickVals() {
            this.joystick.vertical = -1 * ((this.y / this.dragZone.height) - 0.5)
            this.joystick.horizontal = +1 * ((this.x / this.dragZone.width) - 0.5)
        },
        resetJoystickVals() {
            this.joystick.vertical = 0
            this.joystick.horizontal = 0
        },
        // camera
        setCamera: function() {
            let without_wss = this.rosbridge_address.split('wss://')[1]
        console.log(without_wss)
        let domain = without_wss.split('/')[0] + '/' + without_wss.split('/')[1]
        console.log(domain)
        let host = domain + '/cameras'
        
        this.cameraViewer = new MJPEGCANVAS.Viewer({
            divID: 'divCamera',
            host: host,
            width: this.cameraContainer.clientWidth,
            height: this.cameraContainer.clientHeight,
            topic: '/camera/image_raw',
            ssl: true,
        })
        },
        // 3D viewer
        setup3DViewer() {
            this.viewer = new ROS3D.Viewer({
                background: '#cccccc',
                divID: 'div3DViewer',
                width: this.viewerContainer.clientWidth,
                height: this.viewerContainer.clientHeight,
                antialias: true,
                fixedFrame: 'odom'
            })

            // Add a grid.
            this.viewer.addObject(new ROS3D.Grid({
                color:'#0181c4',
                cellSize: 0.5,
                num_cells: 20
            }))

            // Setup a client to listen to TFs.
            this.tfClient = new ROSLIB.TFClient({
                ros: this.ros,
                angularThres: 0.01,
                transThres: 0.01,
                rate: 10.0
            })

            // Setup the URDF client.
            this.urdfClient = new ROS3D.UrdfClient({
                ros: this.ros,
                param: 'robot_description',
                tfClient: this.tfClient,
                // We use "path: location.origin + location.pathname"
                // instead of "path: window.location.href" to remove query params,
                // otherwise the assets fail to load
                path: location.origin + location.pathname,
                rootObject: this.viewer.scene,
                loader: ROS3D.COLLADA_LOADER_2
            })
        },
        resizeViews() {
            if (this.viewer) {
                this.viewer.resize(this.viewerContainer.clientWidth, this.viewerContainer.clientHeight);
            }

            // const mapCanvas = this.mapContainer.querySelector('canvas');
            // if (mapCanvas) {
            //    if (mapCanvas.width !== this.mapContainer.clientWidth || mapCanvas.height !== this.mapContainer.clientHeight) {
            //         mapCanvas.width = this.mapContainer.clientHeight;
            //        mapCanvas.height = this.mapContainer.clientHeight;
            //    }
            // }
        },
        unset3DViewer() {
            document.getElementById('div3DViewer').innerHTML = ''
        },
        // Map viewer
        setupMapViewer () {
            this.mapViewer = new ROS2D.Viewer({
                divID: 'map',
                width: this.mapContainer.clientWidth,
                height: this.mapContainer.clientHeight
            })

            // Setup the map client.
            this.mapGridClient = new ROS2D.OccupancyGridClient({
                ros: this.ros,
                rootObject: this.mapViewer.scene,
                continuous: true,
            })

            // Scale the canvas to fit to the map
            this.mapGridClient.on('change', () => {
            this.mapViewer.scaleToDimensions(this.mapGridClient.currentGrid.width, this.mapGridClient.currentGrid.height);
            this.mapViewer.shift(this.mapGridClient.currentGrid.pose.position.x, this.mapGridClient.currentGrid.pose.position.y)
            })
        },
        // action
        sendGoal: function(goal) {
            this.action.goal = goal
            let actionClient = new ROSLIB.ActionClient({
                ros : this.ros,
                serverName : '/tortoisebot_as',
                actionName : 'course_web_dev_ros/WaypointActionAction'
            })

            this.goal = new ROSLIB.Goal({
                actionClient : actionClient,
                goalMessage: {
                    ...goal
                }
            })

            this.goal.on('status', (status) => {
                this.action.status = status
            })

            this.goal.on('feedback', (feedback) => {
                this.action.feedback = feedback
            })

            this.goal.on('result', (result) => {
                this.action.result = result
                this.action.feedback.state = "idle"
            })

            this.goal.send()
        },
        cancelGoal: function() {
            this.goal.cancel()
            this.action.feedback.state = "idle"
        },
    },
    mounted() {
        window.addEventListener('mouseup', this.stopDrag)
        this.interval = setInterval(() => {
            if (this.ros != null && this.ros.isConnected) {
             this.ros.getNodes((data) => { }, (error) => { })
            }
        }, 10000)
    },
})