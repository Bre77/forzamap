This program was a fun experiment soon after the launch of Forza 5.

I have posted it here so others can play around with it when I inevitably stop host the server. 

## Layout

| Directory   | Site              | Port              |
| ----------- | ----------------- | ----------------- |
| `fh6/`      | fh6.ba.id.au      | 6666 tcp+udp      |
| `fh5/`      | fh5.ba.id.au      | 5555 tcp+udp      |
| `selector/` | forza.ba.id.au    | 5566 tcp (`PORT`) |

Each map app serves HTTP and receives game telemetry on the same port. `docker/` builds one image that runs all three (see `docker/start.js`).
