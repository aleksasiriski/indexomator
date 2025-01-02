<script lang="ts">
	import { page } from '$app/stores';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import AppSidebar from '$lib/components/custom/sidebar/app-sidebar.svelte';
	import Separator from '$lib/components/ui/separator/separator.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import Input from '$lib/components/ui/input/input.svelte';
	import { Power } from 'lucide-svelte';

	let { children, data } = $props();
</script>

<Sidebar.Provider open={true}>
	<AppSidebar />
	<main class="w-full">
		<header class="flex h-16 w-full shrink-0 items-center gap-2 border-b">
			<div class="ml-2"><Sidebar.Trigger /></div>
			<Separator orientation="vertical" class="mr-10 h-4" />
			<h1 class="text-lg">
				{#if $page.url.pathname === '/create/student'}
					Create Student
				{:else if $page.url.pathname === '/create/employee'}
					Create Employee
				{:else if $page.url.pathname === '/create/guest'}
					Create Guest
				{:else if $page.url.pathname === '/instructions'}
					Instructions
				{:else}
					Homepage
				{/if}
			</h1>
		</header>
		{@render children?.()}
	</main>
</Sidebar.Provider>

<form action="/?/logout" method="POST" class="absolute right-14 top-3">
	<Input type="hidden" name="id_session" value={data.id_session} />
	<Button type="submit" variant="outline" size="icon">
		<Power class="h-[1.2rem] w-[1.2rem]" />
		<span class="sr-only">Logout</span>
	</Button>
</form>
