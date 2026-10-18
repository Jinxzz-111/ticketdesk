function formatMessage(ticket) {
  return `New ${ticket.priority} priority ticket #${ticket.id} from ${ticket.requester}: ${ticket.title}`;
}
module.exports = { formatMessage };
