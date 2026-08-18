# Communications adapter runtime

Provider-neutral graph bridge for `ChannelAdapterV1`. A deployment supplies one
`communications.channel-adapter-bundle`; this adapter validates it before
activation and fans it into Notifications durable delivery and lifecycle jobs,
plus Conversations inbound ingestion. Provider credentials and configuration
remain behind the supplied adapter instance.
