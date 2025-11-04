import { http, HttpResponse } from 'msw';

// Basic in-memory store to simulate duplicate registration
const registered = new Set<string>();

export const handlers = [
  http.post('/api/register', async ({ request }) => {
    const body = await request.json().catch(() => ({} as any));
    const { email, password } = body as { email?: string; password?: string };

    if (!email || !password || String(password).length < 6 || !String(email).includes('@')) {
      return HttpResponse.json({ message: 'Invalid input' }, { status: 400 });
    }
    if (registered.has(email)) {
      return HttpResponse.json({ message: 'User already exists' }, { status: 409 });
    }

    registered.add(email);
    return HttpResponse.json(
      {
        message: 'register successful',
        userId: 'u_123',
        email,
        createdAt: new Date().toISOString(),
        questionnaireCompleted: false,
      },
      { status: 201 },
    );
  }),

  http.post('/api/login', async ({ request }) => {
    const body = await request.json().catch(() => ({} as any));
    const { email, password } = body as { email?: string; password?: string };

    if (!email || !password) {
      return HttpResponse.json({ message: 'Invalid input' }, { status: 400 });
    }
    if (!registered.has(email)) {
      return HttpResponse.json({ message: 'Bad credentials' }, { status: 401 });
    }

    // Allow a special email to simulate questionnaire already completed
    const completed = email?.includes('pro.') ? true : false;

    return HttpResponse.json(
      {
        message: 'login successful',
        userId: 'u_123',
        email,
        createdAt: new Date().toISOString(),
        questionnaireCompleted: completed,
      },
      { status: 200 },
    );
  }),
];
