# tortoisebot_webapp

### Launching

Simulation
```
source ~/simulation_ws/devel/setup.bash
roslaunch tortoisebot_gazebo tortoisebot_docking.launch
```

Mapping
```
source ~/simulation_ws/devel/setup.bash
roslaunch tortoisebot_slam mapping.launch
```

Action server
```
source ~/simulation_ws/devel/setup.bash
rosrun course_web_dev_ros tortoisebot_action_server.py
```

Rosbridge and video servers
```
source ~/simulation_ws/devel/setup.bash
roslaunch course_web_dev_ros web.launch
```

tf2_web_republisher
```
rosrun tf2_web_republisher tf2_web_republisher
```

Webpage server
```
cd ~/webpage_ws/tortoisebot_webapp
python -m http.server 7000
```
