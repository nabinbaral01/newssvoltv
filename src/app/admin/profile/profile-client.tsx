'use client';

import type { Role } from '@prisma/client';
import { ExternalLink, Loader2, Save } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { updateProfileAction, type ProfileState } from './actions';
import { AvatarPicker } from '@/components/avatar-picker';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { Card, CardHeader } from '@/components/ui/surface';
import { bylineTitle, initials } from '@/lib/byline';
import { SOCIAL_PLATFORMS } from '@/lib/validation';

export type ProfilePayload = {
  name: string;
  email: string;
  slug: string;
  title: string | null;
  bio: string | null;
  focus: string | null;
  favourites: string | null;
  image: string | null;
  role: Role;
  staffOrder: number;
  socialLinks: Record<string, string>;
  publishedCount: number;
};

export function ProfileClient({
  profile,
  canEditSlug,
}: {
  profile: ProfilePayload;
  canEditSlug: boolean;
}) {
  const router = useRouter();
  const [state, formAction, pending] = React.useActionState<ProfileState, FormData>(
    updateProfileAction,
    {},
  );

  // Mirrored locally so the preview card updates as you type, and so the
  // uploaded avatar has somewhere to live before the form is submitted.
  const [name, setName] = React.useState(profile.name);
  const [title, setTitle] = React.useState(profile.title ?? '');
  const [bio, setBio] = React.useState(profile.bio ?? '');
  const [focus, setFocus] = React.useState(profile.focus ?? '');
  const [favourites, setFavourites] = React.useState(profile.favourites ?? '');
  const [image, setImage] = React.useState(profile.image);

  React.useEffect(() => {
    if (state.ok) {
      toast.success('Profile saved.');
      router.refresh();
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, router]);

  const errors = state.fieldErrors ?? {};

  const previewTitle = title.trim() || bylineTitle({ title: null, role: profile.role });

  return (
    <form action={formAction} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <input type="hidden" name="image" value={image ?? ''} />

      <div className="space-y-6">
        <Card>
          <CardHeader
            title="Byline"
            description="Shown on every article you write and on your public author page."
          />
          <div className="space-y-4 p-4">
            <Field label="Display name" htmlFor="name" error={errors.name}>
              <Input
                id="name"
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={80}
              />
            </Field>

            <Field
              label="Job title"
              htmlFor="title"
              error={errors.title}
              hint={`Optional. Left blank, your byline reads "${bylineTitle({ title: null, role: profile.role })}".`}
            >
              <Input
                id="title"
                name="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={60}
                placeholder="Senior Film Critic"
              />
            </Field>

            <Field
              label="Bio"
              htmlFor="bio"
              error={errors.bio}
              hint={`${bio.length}/600 — a couple of sentences on what you cover.`}
            >
              <Textarea
                id="bio"
                name="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={600}
                rows={4}
              />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Photo"
            description="Square images work best — anything else is centre-cropped. Under 2MB."
          />
          <div className="p-4">
            {/* Saves on selection rather than on submit: the same control the
                reader account page uses, so there is one upload path to get
                right instead of two. */}
            <AvatarPicker name={name} image={image} onChange={setImage} />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="About you"
            description="Three blocks on your author page. Each one is hidden while it is empty, so fill in as many as you want."
          />
          <div className="space-y-4 p-4">
            <Field
              label="Current focus"
              htmlFor="focus"
              error={errors.focus}
              hint="What you are covering right now — a beat, a franchise, a season."
            >
              <Textarea
                id="focus"
                name="focus"
                value={focus}
                onChange={(e) => setFocus(e.target.value)}
                maxLength={600}
                rows={4}
              />
            </Field>

            <Field
              label="Recommends"
              htmlFor="favourites"
              error={errors.favourites}
              hint="The films, shows or games you would put in front of a reader."
            >
              <Textarea
                id="favourites"
                name="favourites"
                value={favourites}
                onChange={(e) => setFavourites(e.target.value)}
                maxLength={600}
                rows={4}
              />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Links"
            description="Rendered on your author page with rel=me. Full URLs only."
          />
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            {SOCIAL_PLATFORMS.map((platform) => (
              <Field
                key={platform.key}
                label={platform.label}
                htmlFor={`social-${platform.key}`}
                error={errors[`social.${platform.key}`]}
              >
                <Input
                  id={`social-${platform.key}`}
                  name={`social.${platform.key}`}
                  type="url"
                  inputMode="url"
                  defaultValue={profile.socialLinks[platform.key] ?? ''}
                  placeholder={platform.placeholder}
                  maxLength={300}
                />
              </Field>
            ))}
          </div>
        </Card>

        {canEditSlug ? (
          <Card>
            <CardHeader
              title="Public URL and masthead order"
              description="Administrators only. Changing the URL breaks existing links to your author page."
            />
            <div className="grid gap-4 p-4 sm:grid-cols-2">
              <Field
                label="Author URL"
                htmlFor="slug"
                error={errors.slug}
                hint={`/author/${profile.slug}`}
              >
                <Input id="slug" name="slug" defaultValue={profile.slug} maxLength={60} />
              </Field>
              <Field
                label="Masthead position"
                htmlFor="staffOrder"
                error={errors.staffOrder}
                hint="Lower sorts first. Equal values fall back to role, then name."
              >
                <Input
                  id="staffOrder"
                  name="staffOrder"
                  type="number"
                  min={0}
                  max={999}
                  defaultValue={profile.staffOrder}
                />
              </Field>
            </div>
          </Card>
        ) : null}
      </div>

      <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        <Card>
          <CardHeader title="How readers see you" />
          <div className="p-4">
            <div className="flex items-start gap-3 rounded-lg border border-border bg-elevated/40 p-3">
              <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-full bg-elevated text-sm font-bold text-accent">
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image} alt="" className="size-full object-cover" />
                ) : (
                  initials(name)
                )}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{name || 'Your name'}</p>
                <p className="text-xs uppercase tracking-widest text-muted">{previewTitle}</p>
                {bio ? <p className="mt-2 text-xs leading-relaxed text-muted">{bio}</p> : null}
              </div>
            </div>

            <dl className="mt-4 space-y-2 text-xs">
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Published stories</dt>
                <dd className="font-medium">{profile.publishedCount}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Sign-in email</dt>
                <dd className="truncate font-medium">{profile.email}</dd>
              </div>
            </dl>

            <Link
              href={`/author/${profile.slug}`}
              target="_blank"
              className="mt-4 inline-flex items-center gap-1.5 text-xs text-accent hover:underline"
            >
              View public page
              <ExternalLink className="size-3" />
            </Link>
          </div>
        </Card>

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? (
            <Loader2 className="mr-1.5 size-4 animate-spin" />
          ) : (
            <Save className="mr-1.5 size-4" />
          )}
          Save profile
        </Button>

        <p className="text-xs leading-relaxed text-muted">
          Your password, email and privacy settings live on{' '}
          <Link href="/account" className="text-accent hover:underline">
            your account page
          </Link>
          .
        </p>
      </aside>
    </form>
  );
}
