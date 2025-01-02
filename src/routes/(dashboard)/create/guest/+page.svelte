<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import * as Form from '$lib/components/ui/form';
	import * as Select from '$lib/components/ui/select';
	import { Input } from '$lib/components/ui/input/index.js';
	import { superForm } from 'sveltekit-superforms';
	import { zodClient } from 'sveltekit-superforms/adapters';
	import { toast } from 'svelte-sonner';
	import { formSchema } from './schema';
	import { page } from '$app/stores';

	let { data, form: actionData } = $props();

	const form = superForm(data.form, {
		validators: zodClient(formSchema),
		onUpdated: ({ form: f }) => {
			if (actionData?.message === undefined) return;
			const msg = actionData.message;
			if (f.valid && $page.status === 200) {
				toast.success(msg);
			} else {
				toast.error(msg);
			}
		}
	});

	const { form: formData, enhance } = form;
</script>

<form method="POST" class="flex h-[90dvh] w-full items-center justify-center px-4" use:enhance>
	<Card.Root class="mx-auto w-full max-w-sm">
		<Card.Header>
			<Card.Title class="text-2xl">Create guest</Card.Title>
			<Card.Description>
				Create a guest who wants to enter the building for the first time.
			</Card.Description>
		</Card.Header>
		<Card.Content class="grid gap-4">
			<Form.Field {form} name="fname">
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label>First name</Form.Label>
						<Input {...props} bind:value={$formData.fname} />
					{/snippet}
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>
			<Form.Field {form} name="lname">
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label>Last name</Form.Label>
						<Input {...props} bind:value={$formData.lname} />
					{/snippet}
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>
			<Form.Field {form} name="identifier">
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label>Index / Email / Last 4 digits from ID</Form.Label>
						<Input {...props} bind:value={$formData.identifier} />
					{/snippet}
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>
			<Form.Field {form} name="department">
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label>Department</Form.Label>
						<Select.Root type="single" bind:value={$formData.department} name={props.name}>
							<Select.Trigger {...props}>
								{$formData.department ?? 'Select the department for the guest'}
							</Select.Trigger>
							<Select.Content>
								{#each data.departments as department (department.id)}
									<Select.Item value={department.name} label={department.name} />
								{/each}
							</Select.Content>
						</Select.Root>
					{/snippet}
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>
			<Form.Field {form} name="guarantorIdentifier">
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label>Guarantor's index / email / last 4 digits from ID</Form.Label>
						<Input {...props} bind:value={$formData.guarantorIdentifier} />
					{/snippet}
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>
			<Form.Button type="submit">Submit</Form.Button>
		</Card.Content>
	</Card.Root>
</form>
