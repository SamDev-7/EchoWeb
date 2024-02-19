<script lang="ts">
	import { json } from '@sveltejs/kit';
	import { onMount } from 'svelte';

	function isNumeric(str: string) {
		if (typeof str != 'string') return false;
		return !isNaN(str) && !isNaN(parseFloat(str));
	}

	let loading = true;
	let loadingError = false;
	let error = false;
	let ended = false;

	let loadingDots = '...';
	let loadingDotsInterval: NodeJS.Timeout;

	let guildName: string, guildIcon: string, guildId: string, channelName: string, channelId: string;

	type User = {
		id: string;
		name: string;
		avatar: string;
	};
	let users = new Map<string, User>();

	type Caption = {
		userId: string;
		content: string;
		timestamp: Date;
	};

	let captions: Caption[] = [];

	let ws: WebSocket;
	onMount(() => {
		loadingDotsInterval = setInterval(() => {
			if (loadingDots.length === 3) {
				loadingDots = '';
			} else {
				loadingDots += '.';
			}
		}, 500);

		// get query param "id"
		const id = new URLSearchParams(location.search).get('id');
		if (id === null) {
			loadingError = true;
			return;
		}
		if (isNumeric(id) === false) {
			loadingError = true;
			return;
		}
		if (id.length <= 16) {
			loadingError = true;
			return;
		}

		connect(id);

		setInterval(cleanupCaptions, 1000);
	});

	function connect(id: string) {
		ws = new WebSocket('ws://localhost:8081');
		ws.onopen = () => {
			ws.send(JSON.stringify({ type: 'ping' }));
		};
		ws.onmessage = (event) => {
			const data = JSON.parse(event.data);
			if (data.type === 'pong') {
				loading = false;
				ws.send(JSON.stringify({ type: 'info', guildId: id }));
				ws.send(JSON.stringify({ type: 'subscribe', guildId: id }));
			}
			if (data.type === 'info') {
				if (data.success === false) {
					error = true;
					return;
				}
				guildName = data.guild.name;
				guildIcon = data.guild.icon;
				guildId = data.guild.id;
				channelName = data.channel.name;
				channelId = data.channel.id;
			}
			if (data.type === 'subscribe') {
				if (data.success === false) {
					loading = true;
					loadingError = true;
					return;
				}
			}
			if (data.type === 'captions') {
				if (data.guildId !== guildId) {
					error = true;
					return;
				}
				let userId = data.userId;
				if (!users.has(userId)) {
					ws.send(JSON.stringify({ type: 'member', guildId: data.guildId, memberId: userId }));
				}

				captions = captions.filter((caption) => caption.userId !== userId);
				captions.push({ userId, content: data.content, timestamp: new Date() });
			}
			if (data.type === 'member') {
				if (data.success === false) {
					error = true;
					return;
				}
				users.set(data.member.id, data.member);
			}
			if (data.type === 'stopped') {
				ended = true;
				return;
			}
			ws.send(JSON.stringify({ error: 'Invalid type' }));
		};
		ws.onclose = () => {
			setTimeout(() => {
				connect(id);
			}, 1000);
		};
	}

	function cleanupCaptions() {
		captions = captions.filter(
			(caption) => new Date().getTime() - caption.timestamp.getTime() < 5000
		);
		captions = captions.slice(-5);
	}

	$: if (loading === false) {
		clearInterval(loadingDotsInterval);
	}
</script>

<div class="h-screen flex flex-col text-center">
	<div class="my-auto space-y-3 flex flex-col h-full">
		{#if loading}
			<p class="text-slate-200 text-4xl font-bold my-auto">
				{#if loadingError}
					Invalid link
				{:else}
					Loading<span class="tracking-wide">{loadingDots}</span>
				{/if}
			</p>
		{:else if error}
			<div class="my-auto">
				<p class="text-slate-200 text-4xl font-bold">An unexpected error occurred</p>
				<p class="font-medium">Please refresh the page</p>
			</div>
		{:else if ended}
			<p class="text-slate-200 text-4xl font-bold my-auto">Caption generation has stopped</p>
		{:else}
			<div class="space-y-3 flex flex-col pt-20 h-[30vh] justify-center">
				<div class="flex mx-auto space-x-4">
					{#if guildIcon}
						<img src={guildIcon} alt="{guildName} icon" class="w-12 h-12 rounded-full" />
					{/if}
					<h1 class="text-4xl font-bold">{guildName}</h1>
				</div>

				<div class="flex flex-row mx-auto space-x-1">
					<svg
						class="w-5 h-5 my-auto"
						aria-label="Voice Channel"
						aria-hidden="false"
						role="img"
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						><path
							fill="currentColor"
							d="M12 3a1 1 0 0 0-1-1h-.06a1 1 0 0 0-.74.32L5.92 7H3a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h2.92l4.28 4.68a1 1 0 0 0 .74.32H11a1 1 0 0 0 1-1V3ZM15.1 20.75c-.58.14-1.1-.33-1.1-.92v-.03c0-.5.37-.92.85-1.05a7 7 0 0 0 0-13.5A1.11 1.11 0 0 1 14 4.2v-.03c0-.6.52-1.06 1.1-.92a9 9 0 0 1 0 17.5Z"
							class=""
						></path><path
							fill="currentColor"
							d="M15.16 16.51c-.57.28-1.16-.2-1.16-.83v-.14c0-.43.28-.8.63-1.02a3 3 0 0 0 0-5.04c-.35-.23-.63-.6-.63-1.02v-.14c0-.63.59-1.1 1.16-.83a5 5 0 0 1 0 9.02Z"
							class=""
						></path></svg
					>
					<p class="font-medium text-lg -mt-0.5">{channelName}</p>
				</div>
			</div>
			<div class="grow max-w-[800px] mx-auto w-full">
				<div class="bg-black/20 mx-20 rounded-md p-5 h-full">
					<div class="space-y-4">
						{#each captions as { userId, content }}
							<div class="grid grid-cols-5">
								<div class="flex space-x-2 mb-auto">
									<img
										src={users.get(userId)?.avatar}
										alt={users.get(userId)?.name}
										class="w-8 h-8 rounded-full"
									/>
									<div class=" my-auto">
										<p class="font-medium -mt-0.5">{users.get(userId)?.name}</p>
									</div>
								</div>
								<div class="my-auto col-span-4">
									<p class="text-left -mt-0.5">{content}</p>
								</div>
							</div>
						{/each}
					</div>
				</div>
			</div>
		{/if}
	</div>
	<p class="text-sm my-3 mt-10 text-slate-300 font-medium">
		Made by <a href="https://samliu.dev" target="_blank" class="text-blue-500 hover:underline"
			>Sam Liu</a
		>
		and
		<a href="https://github.com/SamDev-7/echo" target="_blank" class="text-blue-500 hover:underline"
			>open sourced</a
		>
	</p>
</div>
