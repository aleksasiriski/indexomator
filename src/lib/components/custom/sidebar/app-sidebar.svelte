<script lang="ts">
	import OpenBook from 'lucide-svelte/icons/book-open-text';
	import Briefcase from 'lucide-svelte/icons/briefcase-business';
	import Clipboard from 'lucide-svelte/icons/clipboard-list';
	import Github from 'lucide-svelte/icons/github';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import SidebarFooter from '$lib/components/ui/sidebar/sidebar-footer.svelte';
	import Button from '$lib/components/ui/button/button.svelte';

	// Menu items.
	const items = [
		{
			title: 'Create Student',
			url: '/create/student',
			icon: OpenBook
		},
		{
			title: 'Create Employee',
			url: '/create/employee',
			icon: Briefcase
		},
		{
			title: 'Search',
			url: '/search',
			icon: Clipboard
		}
	];
</script>

<Sidebar.Root>
	<Sidebar.Content>
		<Sidebar.Group>
			<Sidebar.GroupLabel><a href="/" class="font-bold">Indexomator</a></Sidebar.GroupLabel>
			<Sidebar.GroupContent>
				<Sidebar.Menu>
					{#each items as item (item.title)}
						<Sidebar.MenuItem>
							<Sidebar.MenuButton>
								{#snippet child({ props })}
									<a href={item.url} {...props}>
										<item.icon />
										<span>{item.title}</span>
									</a>
								{/snippet}
							</Sidebar.MenuButton>
						</Sidebar.MenuItem>
					{/each}
				</Sidebar.Menu>
			</Sidebar.GroupContent>
		</Sidebar.Group>
	</Sidebar.Content>
	<SidebarFooter>
		<Button variant="link" href="https://github.com/aleksasiriski/indexomator">
			<Github /> <span>Contribute</span>
		</Button>
	</SidebarFooter>
</Sidebar.Root>
