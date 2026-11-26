'use client';

import { Loader2, MailCheck } from 'lucide-react';
import * as React from 'react';

import { sendContactAction, type ContactState } from './actions';
import { TOPICS } from './topics';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';

export function ContactForm() {
  const [state, formAction, pending] = React.useActionState<ContactState, FormData>(
    sendContactAction,
    {},
  );

  if (state.sent) {
    return (
      <div className="rounded-card border border-border bg-surface p-6 text-center" role="status">
        <MailCheck className="mx-auto size-8 text-accent" aria-hidden />
        <h2 className="headline mt-3 text-2xl uppercase">Message sent</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Thanks for getting in touch. We read every message and reply to the address you gave,
          usually within two working days.
        </p>
      </div>
    );
  }

  return (
    // Remounting on each returned state makes the browser apply the echoed
    // defaultValues; a <select> otherwise snaps back to its first option.
    <form
      key={state.values ? JSON.stringify(state.values) : 'blank'}
      action={formAction}
      className="space-y-4"
    >
      {state.error ? (
        <p className="rounded-md border border-danger/40 bg-danger/10 p-3 text-sm text-danger" role="alert">
          {state.error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" htmlFor="contact-name" error={state.fieldErrors?.name}>
          <Input
            id="contact-name"
            name="name"
            autoComplete="name"
            required
            maxLength={100}
            defaultValue={state.values?.name}
          />
        </Field>
        <Field label="Email" htmlFor="contact-email" error={state.fieldErrors?.email}>
          <Input
            id="contact-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            defaultValue={state.values?.email}
          />
        </Field>
      </div>

      <Field label="Topic" htmlFor="contact-topic" error={state.fieldErrors?.topic}>
        <Select id="contact-topic" name="topic" defaultValue={state.values?.topic ?? 'General'}>
          {TOPICS.map((topic) => (
            <option key={topic} value={topic}>
              {topic}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Message" htmlFor="contact-message" error={state.fieldErrors?.message}>
        <Textarea
          id="contact-message"
          name="message"
          required
          minLength={10}
          maxLength={5000}
          rows={7}
          defaultValue={state.values?.message}
        />
      </Field>

      {/* Honeypot. Hidden from people and from screen readers; bots fill it. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="contact-website">Website</label>
        <input id="contact-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        Send message
      </Button>
    </form>
  );
}
