There are two "right" ways to deploy a Meteor app in production:

1. Use `meteor deploy` to run it on Galaxy, Meteor's Appengine-like wrapper around AWS EC2 instances.
2. Use `meteor build` to generate a tarball containing the compiled app, then deploy it as you might any Node.js app.

While Galaxy has some nice features for long-running apps, such as Websockets-aware load balancing, the paid tier is
expensive compared to raw VMs and the DevOps features matter more for an app that will be used for months, not days.
Also, running multiple instances of the app requires special handling for batch operations, and you would need to
arrange your own MongoDB instance, e.g. using MongoDB Atlas. As such I cannot recommend it. However. Meteor 2 added a
free tier that runs a single tiny VM and includes MongoDB hosting. Below is a table of the tradeoffs of two deployment
options:

| Feature     | [Dedicated VM on Google Compute Engine](./Operations-GCE.md)      | [Meteor Galaxy Free Tier](./Operations-Galaxy-Free.md) |
| ----------- | ----------------------------------------------------------------- | ------------------------------------------------------ |
| Price       | :x: ~$1USD per day for n1-standard-1 (Can use free trial credit)  | :heavy_check_mark: free                                |
| Setup Time  | :x: Hours                                                         | :heavy_check_mark: minutes                             |
| Domain Name | :heavy_check_mark: Your custom domain (:x: you must register one) | :x: Must be _something_.meteorapp.com                  |
| Capacity    | :heavy_check_mark: Tested with 100+ member teams                  | :question: Never used in anger                         |
| Persistence | :heavy_check_mark: Runs as long as you leave it on                | :x: Shuts down when not in use, restarts in minutes    |
