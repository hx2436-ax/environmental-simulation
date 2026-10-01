# Environmental Simulation — Uber Ride

A single-page Three.js demonstration of an Uber ride semantic model based on the provided assignment brief. The brief requires a vanilla-JavaScript single-page app whose primary view is a full-window Three.js scene, with interactive controls for manipulating the model. fileciteturn0file0L3-L14

## Model represented

The simulation includes:

- Rider: location + destination
- Driver: location + availability
- Vehicle: location + capacity
- Trip: status + estimated time + fare
- Pickup Location: coordinates
- Destination: coordinates
- Route: path + distance + estimated travel time
- Road: path + traffic level

These entities and attributes follow the supplied semantic model. fileciteturn0file0L22-L60

## Interactive actions

Use the bottom toolbar to:

1. Request a trip.
2. Accept or reject it as the driver.
3. Cancel before departure.
4. Start an accepted trip.
5. Move the vehicle road-by-road.
6. Change traffic conditions.
7. Recalculate the route using weighted traffic conditions.
8. Complete the trip when the vehicle reaches the destination.
9. Reset the demonstration.

These controls implement the actions specified in the assignment, including trip request/acceptance, cancellation, vehicle movement, traffic-based rerouting, and completion at the destination. fileciteturn0file0L74-L82

## Run

Because Three.js modules are imported from a CDN, serve the repository over HTTP rather than opening `index.html` directly.

For example:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

The app is also suitable for GitHub Pages with the repository root as the publishing source.
