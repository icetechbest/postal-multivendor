import { Types } from 'mongoose';
import { SupportTicket } from '../../models/SupportTicket';
import { TicketMessage } from '../../models/TicketMessage';
import { User } from '../../models/User';
import { AuthContext, requireAuth, requireRole } from '../../middleware/auth';
import { AuthorizationError, NotFoundError, ValidationError } from '../../utils/errors';
import { idOf } from './appHelpers';
import { assertObjectId, escapeRegex, pageParams, requirePlatformReader } from './adminHelpers';

const STATUSES = ['open', 'in_progress', 'resolved', 'closed'];

const ticketFilter = (filters: any = {}): Record<string, any> => {
  const filter: Record<string, any> = {};
  if (filters.status && filters.status !== 'all') filter.status = String(filters.status).toLowerCase();
  if (filters.category) filter.category = filters.category;
  if (filters.search?.trim()) {
    const rx = { $regex: escapeRegex(filters.search.trim()), $options: 'i' };
    filter.$or = [{ title: rx }, { description: rx }, { orderId: rx }];
  }
  return filter;
};

const ownsOrIsStaff = (ticket: any, context: AuthContext) => {
  if (['ADMIN', 'STAFF'].includes(context.user!.role)) return;
  if (idOf(ticket.user) !== context.user!.userId) throw new AuthorizationError();
};

const usersWithTickets = async (input: any, context: AuthContext, withLatest: boolean) => {
  requirePlatformReader(context);
  const filters = input || {};
  const p = pageParams(filters.page, filters.limit, 10);
  const match = ticketFilter(filters);
  const groups = await SupportTicket.aggregate([
    { $match: match },
    { $sort: { updatedAt: -1 } },
    { $group: { _id: '$user', latest: { $first: '$_id' }, updatedAt: { $first: '$updatedAt' } } },
    { $sort: { updatedAt: -1 } },
    { $facet: { rows: [{ $skip: p.skip }, { $limit: p.limit }], total: [{ $count: 'n' }] } },
  ]);
  const rows: Array<{ _id: Types.ObjectId; latest: Types.ObjectId }> = groups[0]?.rows || [];
  const docsCount: number = groups[0]?.total?.[0]?.n || 0;
  const [users, tickets] = await Promise.all([
    User.find({ _id: { $in: rows.map((r) => r._id) } }),
    withLatest ? SupportTicket.find({ _id: { $in: rows.map((r) => r.latest) } }) : Promise.resolve([]),
  ]);
  const byId = new Map(users.map((u) => [idOf(u._id), u]));
  const ticketById = new Map((tickets as any[]).map((t) => [idOf(t._id), t]));
  return {
    users: rows
      .map((r) => {
        const u = byId.get(idOf(r._id));
        return u ? { _id: u._id, name: u.name, email: u.email, phone: u.phone, isActive: u.isActive, userType: u.role, latestTicket: ticketById.get(idOf(r.latest)) || null } : null;
      })
      .filter(Boolean),
    docsCount,
    totalPages: Math.max(1, Math.ceil(docsCount / p.limit)),
    currentPage: p.page,
  };
};

export const adminSupportResolvers = {
  Query: {
    getTicketUsersWithLatest: (_parent: unknown, { input }: { input?: any }, context: AuthContext) => usersWithTickets(input, context, true),
    getTicketUsers: (_parent: unknown, { input }: { input?: any }, context: AuthContext) => usersWithTickets(input, context, false),
    getSingleUserSupportTickets: async (_parent: unknown, { input }: { input: { userId: string; filters?: any } }, context: AuthContext) => {
      requireAuth(context);
      const userId = assertObjectId(input.userId, 'user');
      if (!['ADMIN', 'STAFF'].includes(context.user!.role) && context.user!.userId !== userId) throw new AuthorizationError();
      const p = pageParams(input.filters?.page, input.filters?.limit, 10);
      const filter = { ...ticketFilter(input.filters), user: new Types.ObjectId(userId) };
      const [tickets, docsCount] = await Promise.all([
        SupportTicket.find(filter).populate('user').sort({ updatedAt: -1 }).skip(p.skip).limit(p.limit),
        SupportTicket.countDocuments(filter),
      ]);
      return { tickets, docsCount, totalPages: Math.max(1, Math.ceil(docsCount / p.limit)), currentPage: p.page };
    },
    getSingleSupportTicket: async (_parent: unknown, { ticketId }: { ticketId: string }, context: AuthContext) => {
      requireAuth(context);
      const ticket = await SupportTicket.findById(assertObjectId(ticketId, 'ticket')).populate('user');
      if (!ticket) return null;
      ownsOrIsStaff(ticket, context);
      return ticket;
    },
    getTicketMessages: async (_parent: unknown, { input }: { input: { ticket: string; page?: number; limit?: number } }, context: AuthContext) => {
      requireAuth(context);
      const ticket = await SupportTicket.findById(assertObjectId(input.ticket, 'ticket')).populate('user');
      if (!ticket) throw new NotFoundError('Ticket');
      ownsOrIsStaff(ticket, context);
      const p = pageParams(input.page, input.limit, 50);
      const [messages, docsCount] = await Promise.all([
        TicketMessage.find({ ticket: ticket._id }).sort({ createdAt: 1 }).skip(p.skip).limit(p.limit),
        TicketMessage.countDocuments({ ticket: ticket._id }),
      ]);
      // Opening the thread marks the other party's messages as read.
      const staff = ['ADMIN', 'STAFF'].includes(context.user!.role);
      await TicketMessage.updateMany({ ticket: ticket._id, senderType: staff ? 'user' : 'admin', isRead: false }, { $set: { isRead: true } });
      return { messages, ticket, page: p.page, totalPages: Math.max(1, Math.ceil(docsCount / p.limit)), docsCount };
    },
  },
  Mutation: {
    createSupportTicket: async (_parent: unknown, { ticketInput }: { ticketInput: any }, context: AuthContext) => {
      requireAuth(context);
      const title = ticketInput.title?.trim();
      if (!title) throw new ValidationError('Title is required');
      const ticket = await SupportTicket.create({
        user: context.user!.userId,
        title: title.slice(0, 200),
        description: ticketInput.description?.slice(0, 4000),
        category: ticketInput.category,
        orderId: ticketInput.orderId,
        otherDetails: ticketInput.otherDetails?.slice(0, 4000),
      });
      return ticket.populate('user');
    },
    createMessage: async (_parent: unknown, { messageInput }: { messageInput: { content: string; ticket: string } }, context: AuthContext) => {
      requireAuth(context);
      const ticket = await SupportTicket.findById(assertObjectId(messageInput.ticket, 'ticket'));
      if (!ticket) throw new NotFoundError('Ticket');
      ownsOrIsStaff(ticket, context);
      const content = messageInput.content?.trim();
      if (!content) throw new ValidationError('Message cannot be empty');
      const staff = ['ADMIN', 'STAFF'].includes(context.user!.role);
      const message = await TicketMessage.create({ ticket: ticket._id, content: content.slice(0, 4000), senderType: staff ? 'admin' : 'user', sender: context.user!.userId });
      if (staff && ticket.status === 'open') ticket.status = 'in_progress';
      ticket.set('updatedAt', new Date());
      await ticket.save();
      return message;
    },
    updateSupportTicketStatus: async (_parent: unknown, { input }: { input: { ticketId: string; status: string } }, context: AuthContext) => {
      requireRole(context, ['ADMIN', 'STAFF']);
      const status = input.status.toLowerCase();
      if (!STATUSES.includes(status)) throw new ValidationError(`Status must be one of ${STATUSES.join(', ')}`);
      const ticket = await SupportTicket.findByIdAndUpdate(assertObjectId(input.ticketId, 'ticket'), { $set: { status } }, { new: true }).populate('user');
      if (!ticket) throw new NotFoundError('Ticket');
      return ticket;
    },
  },
};
