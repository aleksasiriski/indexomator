<script lang="ts" generics="TData, TValue">
	import { type ColumnDef, getCoreRowModel } from '@tanstack/table-core';
	import { createSvelteTable, FlexRender } from '$lib/components/ui/data-table/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import { enhance } from '$app/forms';
	import { ArrowLeftRight } from 'lucide-svelte';
	import type { PersonType } from '$lib/types/person';
	import type { State } from '$lib/types/state';

	type DataTableProps<TData, TValue> = {
		columns: ColumnDef<TData, TValue>[];
		data: TData[];
	};

	let { data, columns }: DataTableProps<TData, TValue> = $props();

	const table = createSvelteTable({
		get data() {
			return data;
		},
		columns,
		getCoreRowModel: getCoreRowModel()
	});
</script>

<div class="mx-auto my-5 max-w-[90vw] rounded-md border">
	<Table.Root>
		<Table.Header>
			{#each table.getHeaderGroups() as headerGroup (headerGroup.id)}
				<Table.Row>
					{#each headerGroup.headers as header (header.id)}
						<Table.Head>
							{#if !header.isPlaceholder}
								<FlexRender
									content={header.column.columnDef.header}
									context={header.getContext()}
								/>
							{/if}
						</Table.Head>
					{/each}
				</Table.Row>
			{/each}
		</Table.Header>
		<Table.Body>
			{#each table.getRowModel().rows as row (row.id)}
				{@const type = row.getVisibleCells()[0].getValue() as PersonType}
				{@const id = row.getVisibleCells()[1].getValue() as number}
				<Table.Row data-state={row.getIsSelected() && 'selected'}>
					{#each row.getVisibleCells() as cell, idx (cell.id)}
						<Table.Cell>
							<div class="flex">
								<FlexRender content={cell.column.columnDef.cell} context={cell.getContext()} />
								{#if idx === 5}
									{@const state = cell.getValue() as State}
									<form method="POST" use:enhance>
										<input type="hidden" name="type" value={type} />
										<button type="submit" class="px-0.5" name="id" value={id}>
											<ArrowLeftRight />
										</button>
									</form>
								{/if}
							</div>
						</Table.Cell>
					{/each}
				</Table.Row>
			{:else}
				<Table.Row>
					<Table.Cell colspan={columns.length} class="h-24 text-center">No results.</Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>
</div>
